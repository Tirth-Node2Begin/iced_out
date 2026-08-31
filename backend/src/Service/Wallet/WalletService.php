<?php

declare(strict_types=1);

namespace Iced\Service\Wallet;

use Iced\Domain\Money;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Support\Clock;

/**
 * The only thing in this system that moves store credit.
 *
 * Everything that touches a wallet goes through `credit()` and `debit()` — the
 * return that settles, the voucher that is poured in, the order that spends it,
 * the reversal when an order is cancelled. There is no second write path
 * anywhere, which is what makes the two invariants below provable rather than
 * merely intended:
 *
 *   · the balance never goes below zero
 *   · every rupee of movement has a row saying where it went
 *
 * THE LOCK. Both writers open with `SELECT ... FOR UPDATE` on the account row
 * before they read the balance they are about to change. Without it, two
 * checkouts submitted together both read ₹500, both decide ₹500 is spendable,
 * and both write — and the shop has paid for the same credit twice. Holding the
 * row makes the second one wait for the first to commit, so it reads ₹0 and is
 * refused. It also means the read-then-insert idempotency check below is safe:
 * nothing else can insert an entry for this wallet in between.
 *
 * IDEMPOTENCY. Every movement carries a `(kind, reference)` pair — the return
 * that caused it, the order that spent it, the voucher it came from — and a
 * unique index on that pair means the same event can be replayed as often as it
 * likes without minting or destroying money. Settling a return twice credits
 * once. A double-tapped checkout debits once. This matters more than it looks:
 * `ReturnService::settle()` is retryable by design, and the old voucher path
 * relied on a check that a concurrent call could walk straight past.
 *
 * MONEY OWED, NOT MONEY HELD. This is store credit arising from returns and
 * from vouchers the shop issued — it is a liability the shop settles in goods.
 * Nothing here takes a deposit, and there is no path out to a bank account,
 * which is what keeps it clear of the payment-instrument rules that would
 * otherwise apply. `withdraw` is deliberately not a method on this class.
 */
final class WalletService
{
    /** Every reason money is allowed to move. Mirrors the CHECK in 0026. */
    public const KIND_RETURN = 'return';
    public const KIND_EXCHANGE = 'exchange';
    public const KIND_VOUCHER = 'voucher';
    public const KIND_ORDER = 'order';
    public const KIND_REVERSAL = 'reversal';
    public const KIND_ADJUSTMENT = 'adjustment';

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** What is spendable right now. Zero for a customer who has never had any. */
    public function balance(int $userId): Money
    {
        $row = $this->db->selectOne('SELECT balance FROM wallet_accounts WHERE user_id = ?', [$userId]);

        return $row === null
            ? Money::fromRupees(0)
            : Money::fromDecimalString((string) $row['balance']);
    }

    /**
     * The statement, newest first.
     *
     * Every row carries the balance it left behind, so the list reads as a
     * history rather than as a pile of amounts the reader has to add up.
     *
     * @return list<array<string, mixed>>
     */
    public function statement(int $userId, int $limit = 100): array
    {
        return $this->db->select(
            'SELECT e.* FROM wallet_entries e
               JOIN wallet_accounts a ON a.id = e.account_id
              WHERE a.user_id = ?
              ORDER BY e.id DESC
              LIMIT ' . max(1, min(500, $limit)),
            [$userId],
        );
    }

    /**
     * Money in.
     *
     * Returns the entry that was written, or the one that already existed for
     * this `(kind, reference)` — never a second one. A caller that needs to
     * know which it got can compare `created_at`, but almost none do: "the
     * credit for ret-072 exists" is the whole postcondition.
     *
     * @return array<string, mixed>|null null for a zero or negative amount,
     *         which is not an error — an even exchange credits nothing, and
     *         making every caller check first would put that branch in six
     *         places instead of one
     */
    public function credit(int $userId, Money $amount, string $kind, string $reference, string $note): ?array
    {
        if ($amount->paise <= 0) {
            return null;
        }

        return $this->db->transaction(function () use ($userId, $amount, $kind, $reference, $note): array {
            $account = $this->lockedAccount($userId);
            $existing = $this->existing($kind, $reference);

            if ($existing !== null) {
                return $existing;
            }

            $after = Money::fromDecimalString((string) $account['balance'])->plus($amount);

            return $this->write((int) $account['id'], 'credit', $amount, $after, $kind, $reference, $note);
        });
    }

    /**
     * Money out.
     *
     * Refuses rather than clamps. A debit that quietly took less than it was
     * asked for would leave the caller's arithmetic — the gateway amount, the
     * order total — describing a payment that did not happen. Callers that WANT
     * clamping ask `spendable()` first, which is honest about being a quote.
     *
     * @throws ConflictException when the balance will not cover it
     *
     * @return array<string, mixed>|null null for a zero amount
     */
    public function debit(int $userId, Money $amount, string $kind, string $reference, string $note): ?array
    {
        if ($amount->paise <= 0) {
            return null;
        }

        return $this->db->transaction(function () use ($userId, $amount, $kind, $reference, $note): array {
            $account = $this->lockedAccount($userId);
            $existing = $this->existing($kind, $reference);

            /* Already spent for this reference — the retry of a checkout that
               committed. Handing back the original entry is what makes a double
               tap cost the customer once. */
            if ($existing !== null) {
                return $existing;
            }

            $balance = Money::fromDecimalString((string) $account['balance']);

            if ($amount->isGreaterThan($balance)) {
                throw new ConflictException(
                    'ICE-WAL-409',
                    sprintf(
                        'Your wallet has ₹%s, which is less than the ₹%s this order asked it for. Refresh and try again.',
                        number_format($balance->rupees()),
                        number_format($amount->rupees()),
                    ),
                    [],
                    true,
                );
            }

            return $this->write((int) $account['id'], 'debit', $amount, $balance->minus($amount), $kind, $reference, $note);
        });
    }

    /**
     * How much of a bill the wallet could pay — a QUOTE, not a reservation.
     *
     * The lesser of the balance and what is owed, because credit cannot pay
     * more than the order costs and there is no change given. Nothing is held:
     * by the time the order is placed the balance may have moved, which is why
     * `debit()` re-reads it under the lock and is allowed to refuse.
     */
    public function spendable(int $userId, Money $payable): Money
    {
        return $this->balance($userId)->clampTo($payable->atLeastZero())->atLeastZero();
    }

    /**
     * Give back what an order took, when the order goes away.
     *
     * A separate `kind` rather than a credit of kind `order`, so that a
     * cancellation cannot collide with the original debit's idempotency key —
     * and so the statement can say "returned to your wallet" instead of
     * printing a second line that looks like the first one backwards.
     */
    public function reverseOrder(int $userId, Money $amount, string $orderNumber, string $note): ?array
    {
        return $this->credit($userId, $amount, self::KIND_REVERSAL, $orderNumber, $note);
    }

    /**
     * The account row, locked, created if this customer has never had one.
     *
     * `INSERT ... ON DUPLICATE KEY UPDATE` rather than a check-then-insert: two
     * requests arriving together for a customer with no wallet would both find
     * nothing and both insert, and the unique index would fail the loser. The
     * upsert is a no-op when the row exists, and the SELECT after it takes the
     * lock either way.
     *
     * @return array<string, mixed>
     */
    private function lockedAccount(int $userId): array
    {
        $this->db->statement(
            'INSERT INTO wallet_accounts (user_id, balance, created_at)
             VALUES (?, 0.00, ?)
             ON DUPLICATE KEY UPDATE user_id = user_id',
            [$userId, $this->clock->nowString()],
        );

        $account = $this->db->selectOne(
            'SELECT id, balance FROM wallet_accounts WHERE user_id = ? FOR UPDATE',
            [$userId],
        );

        if ($account === null) {
            // Unreachable through the upsert above; kept because the alternative
            // is a null dereference two lines later if it ever stops being true.
            throw new ConflictException('ICE-WAL-409', 'That wallet could not be opened. Please try again.');
        }

        return $account;
    }

    /**
     * The entry already written for this event, if there is one.
     *
     * Safe as a plain read because the caller is holding the account row: no
     * other writer can be inserting for this wallet while this runs. The unique
     * index on `(kind, reference)` is still there underneath as the guarantee.
     *
     * @return array<string, mixed>|null
     */
    private function existing(string $kind, string $reference): ?array
    {
        if ($reference === '') {
            return null;
        }

        return $this->db->selectOne(
            'SELECT * FROM wallet_entries WHERE kind = ? AND reference = ? LIMIT 1',
            [$kind, $reference],
        );
    }

    /**
     * The insert, plus the balance it implies. One place, so the entry and the
     * account can never disagree about what just happened.
     *
     * @return array<string, mixed>
     */
    private function write(
        int $accountId,
        string $direction,
        Money $amount,
        Money $after,
        string $kind,
        string $reference,
        string $note,
    ): array {
        $now = $this->clock->nowString();

        $id = $this->db->insert(
            'INSERT INTO wallet_entries (account_id, direction, amount, balance_after, kind, reference, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$accountId, $direction, $amount->toDecimalString(), $after->toDecimalString(), $kind, $reference, $note, $now],
        );

        $this->db->statement(
            'UPDATE wallet_accounts SET balance = ?, updated_at = ? WHERE id = ?',
            [$after->toDecimalString(), $now, $accountId],
        );

        $row = $this->db->selectOne('SELECT * FROM wallet_entries WHERE id = ?', [$id]);

        return $row ?? [];
    }
}
