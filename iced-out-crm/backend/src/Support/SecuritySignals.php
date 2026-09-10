<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Database;
use Throwable;

/**
 * Security events, raised where an operator will actually see them.
 *
 * Two destinations, and the split is deliberate rather than belt-and-braces:
 *
 *   the LOG    always, as one structured line with a stable event name. This is
 *              the record — greppable, ordered, and safe to keep for months.
 *   ops_signals  only when the event is something a human must ACT on, and only
 *              for the kinds that table already allows. This is the interrupt.
 *
 * WHY NOT A 'security' KIND. `ops_signals` carries
 * `CHECK (kind IN ('order','payment','shipment','inventory','return','support','review'))`,
 * and widening it would mean dropping and re-adding a constraint on a live table
 * — a schema change to something that already works, to hold a label. The events
 * that belong on that board are payment and order events anyway, and they are
 * filed as exactly that. Anything with no honest home there stays in the log,
 * where an alert can still find it.
 *
 * NOTHING HERE MAY THROW. A signal is an observation about a request, never part
 * of it: an ops board that is full, locked, or missing must not be able to fail
 * a payment. Every write is wrapped, and a failure to record is itself logged.
 */
final class SecuritySignals
{
    /** The tones `ops_signals` allows, worst first. */
    public const TONE_ROSE = 'rose';
    public const TONE_AMBER = 'amber';
    public const TONE_INK = 'ink';

    public function __construct(
        private readonly Database $db,
        private readonly Logger $logger,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Someone is posting to the webhook URL who cannot sign like Razorpay.
     *
     * Rose, because there is no benign explanation once the endpoint is live and
     * the secret is right: either the secret has rotated on one side only, or
     * this is someone trying to tell us a payment happened.
     *
     * @param array<string, mixed> $context
     */
    public function webhookSignatureFailed(string $provider, array $context = []): void
    {
        $this->raise(
            'webhook.signature_failed',
            'payment',
            self::TONE_ROSE,
            sprintf('A %s webhook arrived with a bad signature', $provider),
            'It was refused and recorded. Check the webhook secret on both sides.',
            $context,
        );
    }

    /**
     * A signature that did not match the key secret on a checkout verification.
     *
     * Should be zero a day. One is a shopper on a flaky connection retrying
     * something odd; a run of them is someone forging payment ids.
     *
     * @param array<string, mixed> $context
     */
    public function paymentSignatureFailed(array $context = []): void
    {
        $this->raise(
            'payment.signature_failed',
            'payment',
            self::TONE_AMBER,
            'A payment signature did not verify',
            'The payment was not recorded. Repeated failures mean forged payment ids.',
            $context,
        );
    }

    /**
     * An order claimed a capture the server could not match to a payment.
     *
     * This is the direct evidence of amount tampering, and of the old exploit
     * being tried: a request saying `captured` with no verified intent worth
     * what the bag came to. It is also, harmlessly, what a genuine shopper
     * produces when the gateway succeeded but our verify call never landed —
     * which is why it is amber and names the order rather than paging anyone.
     *
     * @param array<string, mixed> $context
     */
    public function paymentIntentMismatch(string $orderNumber, array $context = []): void
    {
        $this->raise(
            'payment.intent_mismatch',
            'payment',
            self::TONE_AMBER,
            sprintf('%s claimed a payment that could not be confirmed', $orderNumber),
            'Written as unpaid. Check the gateway before treating it as fulfilled.',
            $context + ['order' => $orderNumber],
            'order',
            $orderNumber,
        );
    }

    /**
     * The gateway took money that no order ever claimed.
     *
     * The worst of the payment failures and the one that must never be silent:
     * a shopper has been charged and has nothing to show for it.
     *
     * @param array<string, mixed> $context
     */
    public function orphanedPayment(string $gatewayPaymentId, array $context = []): void
    {
        $this->raise(
            'payment.orphaned',
            'payment',
            self::TONE_ROSE,
            'A payment was taken with no order against it',
            sprintf('%s is captured at the gateway and unclaimed here. Refund or place the order by hand.', $gatewayPaymentId),
            $context + ['payment' => $gatewayPaymentId],
        );
    }

    /**
     * The refund ledger and the gateway disagree.
     *
     * Rose, because both directions of this are money: either a customer was
     * repaid and the books do not know, or the books say they were repaid and
     * the gateway says otherwise. Refunds here are bookkeeping a person mirrors
     * in the Razorpay dashboard by hand, so the two CAN drift, and until now
     * nothing would ever have said so.
     *
     * @param array<string, mixed> $context
     */
    public function refundDiverged(string $orderNumber, string $detail, array $context = []): void
    {
        $this->raise(
            'refund.diverged',
            'return',
            self::TONE_ROSE,
            sprintf('Refund mismatch on %s', $orderNumber),
            $detail,
            $context + ['order' => $orderNumber],
            'order',
            $orderNumber,
        );
    }

    /**
     * An account was locked out by repeated failures.
     *
     * Log only. There is no `auth` kind, and a lockout is not something an
     * operator opens the dashboard to fix — it is something an alert counts.
     *
     * @param array<string, mixed> $context
     */
    public function authLockout(array $context = []): void
    {
        $this->logger->warning('auth.lockout', $context);
    }

    /**
     * Rate limiting could not be enforced because its store is unusable.
     *
     * Log only, and loudly: while this is true every bucket in the application
     * is either open or closed by accident rather than by policy.
     *
     * @param array<string, mixed> $context
     */
    public function rateLimiterUnavailable(array $context = []): void
    {
        $this->logger->error('ratelimit.unavailable', $context);
    }

    /**
     * A privileged console action that the audit trail should not be the only
     * record of. Log only.
     *
     * @param array<string, mixed> $context
     */
    public function privilegedAction(string $event, array $context = []): void
    {
        $this->logger->info('admin.' . $event, $context);
    }

    /**
     * The log line, then the board — in that order, so the record survives even
     * if the board write is what fails.
     *
     * @param array<string, mixed> $context
     */
    private function raise(
        string $event,
        string $kind,
        string $tone,
        string $title,
        string $detail,
        array $context = [],
        string $entityType = '',
        string $entityId = '',
    ): void {
        $this->logger->warning($event, $context);

        try {
            $this->db->statement(
                'INSERT INTO ops_signals (kind, tone, title, detail, entity_type, entity_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    $kind,
                    $tone,
                    mb_substr($title, 0, 160),
                    mb_substr($detail, 0, 255),
                    mb_substr($entityType, 0, 40),
                    mb_substr($entityId, 0, 64),
                    $this->clock->nowString(),
                ],
            );
        } catch (Throwable $error) {
            // Never let the board take the request down with it.
            $this->logger->exception($error, ['stage' => 'ops_signal', 'event' => $event]);
        }
    }
}
