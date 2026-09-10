<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;
use PDOException;

/**
 * `payment_intents` — the server's own record of a gateway payment, and the only
 * thing `PlaceOrderService` will accept as proof that money moved.
 *
 * The state machine is deliberately small, and every transition is a single
 * conditional UPDATE rather than a read followed by a write:
 *
 *     CREATED ──verify()──▶ VERIFIED ──consume()──▶ CONSUMED   (terminal)
 *        │                     │
 *        └──fail()──▶ FAILED   └──expire()──▶ EXPIRED
 *
 * `WHERE status = 'CREATED'` on the promotion and `WHERE status = 'VERIFIED'` on
 * the consumption are what make both idempotent: the second caller changes zero
 * rows and is told so by the row count, so there is no read-then-write window
 * for two requests to race through. This is the same lesson the wallet learned —
 * the guarantee belongs in the statement, not in the code around it.
 *
 * Every method that can lead to money moving takes `$userId` and puts it in the
 * WHERE clause. An intent is not a bearer token: knowing a `razorpay_order_id`
 * is not enough to spend it, because the row will not match anyone else's id.
 */
final class PaymentIntentRepository
{
    public const STATUS_CREATED = 'CREATED';
    public const STATUS_VERIFIED = 'VERIFIED';
    public const STATUS_CONSUMED = 'CONSUMED';
    public const STATUS_FAILED = 'FAILED';
    public const STATUS_EXPIRED = 'EXPIRED';

    /**
     * How long a verified payment may sit unused before an order must claim it.
     *
     * Longer than any honest gap between the gateway closing and the order
     * landing; short enough that a session someone else has cannot bank one.
     */
    public const TTL_SECONDS = 900;

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Records the gateway order the browser is about to be shown.
     *
     * `INSERT ... ON DUPLICATE KEY UPDATE id = id` rather than a plain insert:
     * Razorpay ids are unique, so a duplicate here means the same call was
     * retried, and the honest answer is "that intent already exists" rather than
     * a 500 from the unique index.
     */
    public function create(
        string $razorpayOrderId,
        int $userId,
        int $amountPaise,
        string $currency,
        string $quoteHash = '',
    ): void {
        $this->db->statement(
            'INSERT INTO payment_intents
                (razorpay_order_id, user_id, amount_paise, currency, quote_hash, status, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id = id',
            [
                $razorpayOrderId,
                $userId,
                $amountPaise,
                $currency,
                $quoteHash,
                self::STATUS_CREATED,
                $this->clock->addSeconds(self::TTL_SECONDS)->format(Clock::STORAGE_FORMAT),
                $this->clock->nowString(),
            ],
        );
    }

    /**
     * Promotes an intent to VERIFIED. Returns false when nothing was promoted.
     *
     * Called only after the signature has been checked against the key secret.
     * Four conditions, and each is load-bearing:
     *
     *   razorpay_order_id  the intent this payment claims to be for
     *   user_id            the account that created it — not the one asking
     *   status = 'CREATED' so a second verify changes nothing
     *   expires_at >       a stale intent is not resurrected by a late call
     *
     * The unique index on `razorpay_payment_id` is underneath all of it: a
     * payment id already written against another intent cannot be written here,
     * and the insert fails rather than quietly binding it twice.
     */
    public function markVerified(
        string $razorpayOrderId,
        int $userId,
        string $razorpayPaymentId,
        string $gatewayStatus = '',
        string $gatewayMethod = '',
    ): bool {
        $now = $this->clock->nowString();

        try {
            $rows = $this->db->statement(
                'UPDATE payment_intents
                    SET status = ?, razorpay_payment_id = ?, gateway_status = ?, gateway_method = ?, verified_at = ?
                  WHERE razorpay_order_id = ?
                    AND user_id = ?
                    AND status = ?
                    AND expires_at > ?',
                [
                    self::STATUS_VERIFIED,
                    $razorpayPaymentId,
                    mb_substr($gatewayStatus, 0, 24),
                    mb_substr($gatewayMethod, 0, 40),
                    $now,
                    $razorpayOrderId,
                    $userId,
                    self::STATUS_CREATED,
                    $now,
                ],
            );
        } catch (PDOException) {
            /* uq_payment_intents_payment refused it: this payment id is already
               bound to a different intent. That is a replay, and "not verified"
               is the truthful answer — a 500 would report our own index as a
               server fault. */
            return false;
        }

        return $rows > 0;
    }

    /** A signature that did not check out, or a payment the gateway refused. */
    public function markFailed(string $razorpayOrderId, int $userId): void
    {
        $this->db->statement(
            'UPDATE payment_intents SET status = ? WHERE razorpay_order_id = ? AND user_id = ? AND status = ?',
            [self::STATUS_FAILED, $razorpayOrderId, $userId, self::STATUS_CREATED],
        );
    }

    /**
     * The verified payment this order may settle against, locked — or null.
     *
     * `FOR UPDATE` because the caller is inside the place-order transaction and
     * is about to consume what it finds. Without the lock two concurrent orders
     * could both read the same VERIFIED row before either wrote CONSUMED.
     *
     * The amount is matched EXACTLY, in paise. This is the check that makes the
     * gateway figure server-authoritative: the browser may ask Razorpay for any
     * amount it likes, but the order will only accept an intent worth precisely
     * what the bag came to when priced from the catalogue.
     *
     * Oldest first, so a customer who somehow holds two identical verified
     * intents spends the one that will expire soonest.
     *
     * @return array<string, mixed>|null
     */
    public function claimable(int $userId, int $amountPaise): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM payment_intents
              WHERE user_id = ?
                AND status = ?
                AND amount_paise = ?
                AND expires_at > ?
              ORDER BY id
              LIMIT 1
              FOR UPDATE',
            [$userId, self::STATUS_VERIFIED, $amountPaise, $this->clock->nowString()],
        );
    }

    /**
     * Spends the intent on an order. Terminal, and idempotent by the WHERE.
     *
     * Returns false if the row was not in VERIFIED any more — which, inside a
     * transaction that is holding the lock from `claimable()`, cannot happen,
     * and is checked anyway because the alternative is an order that believes it
     * was paid for by a row that says otherwise.
     */
    public function consume(int $intentId, int $orderId): bool
    {
        $rows = $this->db->statement(
            'UPDATE payment_intents
                SET status = ?, order_id = ?, consumed_at = ?
              WHERE id = ? AND status = ?',
            [self::STATUS_CONSUMED, $orderId, $this->clock->nowString(), $intentId, self::STATUS_VERIFIED],
        );

        return $rows > 0;
    }

    /**
     * One intent by its gateway order id, unscoped.
     *
     * For the WEBHOOK, which is authenticated by a signature over the whole body
     * rather than by a session, and so has no principal to scope by. Never call
     * this from a request-driven path — use the scoped methods above.
     *
     * @return array<string, mixed>|null
     */
    public function findByGatewayOrderId(string $razorpayOrderId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM payment_intents WHERE razorpay_order_id = ? LIMIT 1',
            [$razorpayOrderId],
        );
    }

    /** @return array<string, mixed>|null */
    public function findByGatewayPaymentId(string $razorpayPaymentId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM payment_intents WHERE razorpay_payment_id = ? LIMIT 1',
            [$razorpayPaymentId],
        );
    }

    /**
     * The webhook's own promotion, by gateway order id rather than by session.
     *
     * Razorpay's `payment.captured` is authoritative and can arrive before the
     * browser gets back to us — a shopper who closed the tab the moment the
     * gateway said yes. Promoting here means the order they place on their next
     * visit still finds a verified intent.
     *
     * The signature over the request body is what authorises this; see
     * `RazorpayWebhookController`.
     */
    public function markVerifiedByGateway(
        string $razorpayOrderId,
        string $razorpayPaymentId,
        string $gatewayStatus = '',
        string $gatewayMethod = '',
    ): bool {
        $now = $this->clock->nowString();

        try {
            $rows = $this->db->statement(
                'UPDATE payment_intents
                    SET status = ?, razorpay_payment_id = ?, gateway_status = ?, gateway_method = ?, verified_at = ?
                  WHERE razorpay_order_id = ?
                    AND status = ?
                    AND expires_at > ?',
                [
                    self::STATUS_VERIFIED,
                    $razorpayPaymentId,
                    mb_substr($gatewayStatus, 0, 24),
                    mb_substr($gatewayMethod, 0, 40),
                    $now,
                    $razorpayOrderId,
                    self::STATUS_CREATED,
                    $now,
                ],
            );
        } catch (PDOException) {
            // Same replay case as markVerified() above.
            return false;
        }

        return $rows > 0;
    }

    /**
     * Money the gateway says it took that no order ever claimed.
     *
     * The one query the reconciliation signal of §20 is built on: a VERIFIED or
     * CONSUMED-less intent past its expiry is a shopper who was charged and has
     * no order to show for it, which is the failure that must never be silent.
     *
     * @return list<array<string, mixed>>
     */
    public function orphanedVerified(int $olderThanSeconds = 900, int $limit = 100): array
    {
        return $this->db->select(
            'SELECT * FROM payment_intents
              WHERE status = ?
                AND razorpay_payment_id IS NOT NULL
                AND verified_at < ?
              ORDER BY id
              LIMIT ' . max(1, min(500, $limit)),
            [
                self::STATUS_VERIFIED,
                $this->clock->addSeconds(-$olderThanSeconds)->format(Clock::STORAGE_FORMAT),
            ],
        );
    }

    /**
     * Retires intents nobody ever paid. Returns how many were retired.
     *
     * ONLY `CREATED` rows: an expired VERIFIED intent is money that moved and
     * must stay visible to `orphanedVerified()` above rather than being tidied
     * into a status that reads like nothing happened.
     */
    public function expireStale(): int
    {
        return $this->db->statement(
            'UPDATE payment_intents SET status = ? WHERE status = ? AND expires_at < ?',
            [self::STATUS_EXPIRED, self::STATUS_CREATED, $this->clock->nowString()],
        );
    }
}
