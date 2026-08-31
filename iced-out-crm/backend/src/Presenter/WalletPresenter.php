<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;
use Iced\Service\Wallet\WalletService;

/**
 * A wallet statement, in the words a customer would use about their own money.
 *
 * The database says `kind: 'return'`, `direction: 'credit'`. Nobody reading
 * their own statement wants either of those words, so this turns the pair into
 * a title and a sentence — "Return ret-072", "Credit from a return you sent
 * back" — and hands the browser a `sign` it can style rather than a boolean it
 * has to interpret.
 *
 * Amounts are whole rupees, like every other figure crossing this boundary. The
 * ledger keeps paise; nothing in this shop is ever priced in them.
 */
final class WalletPresenter
{
    /**
     * Every movement, titled. The `%s` takes the reference — a return number, an
     * order number, a voucher code — which is what makes a line traceable back
     * to the thing that caused it.
     *
     * @var array<string, array{0: string, 1: string}>
     */
    private const LABELS = [
        WalletService::KIND_RETURN => ['Return %s', 'Credit for a piece you sent back.'],
        WalletService::KIND_EXCHANGE => ['Exchange %s', 'The difference on a swap into something cheaper.'],
        WalletService::KIND_VOUCHER => ['Voucher %s', 'A voucher you added to your wallet.'],
        WalletService::KIND_ORDER => ['Order %s', 'Spent on an order.'],
        WalletService::KIND_REVERSAL => ['Order %s cancelled', 'Returned to your wallet.'],
        WalletService::KIND_ADJUSTMENT => ['Adjustment', 'Made by the store.'],
    ];

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function entry(array $row): array
    {
        $kind = (string) $row['kind'];
        $reference = (string) $row['reference'];
        $credit = (string) $row['direction'] === 'credit';

        [$titleTemplate, $note] = self::LABELS[$kind] ?? ['Wallet movement', ''];

        return [
            /* `wtx-000123` from the row id rather than a column of its own: the
               statement is the customer's own, the id is already unique, and a
               second identifier would only be a second thing to keep in step. */
            'id' => 'wtx-' . str_pad((string) $row['id'], 6, '0', STR_PAD_LEFT),
            'direction' => $credit ? 'credit' : 'debit',
            /* Signed for display and unsigned for arithmetic, both given, so no
               screen has to build one from the other and get the sign wrong. */
            'sign' => $credit ? '+' : '−',
            'amount' => Money::fromDecimalString((string) $row['amount'])->rupees(),
            'balanceAfter' => Money::fromDecimalString((string) $row['balance_after'])->rupees(),
            'kind' => $kind,
            'reference' => $reference,
            'title' => $reference === '' ? rtrim(sprintf($titleTemplate, ''), ' ') : sprintf($titleTemplate, $reference),
            // What the operator typed, if anything, else the standing sentence
            // for this kind of movement.
            'note' => (string) $row['note'] !== '' ? (string) $row['note'] : $note,
            'at' => (string) $row['created_at'],
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function entries(array $rows): array
    {
        return array_map(fn (array $row): array => $this->entry($row), $rows);
    }

    /**
     * The two figures the wallet page leads with, beside the balance.
     *
     * Computed over the WHOLE statement rather than the page of it that was
     * fetched, so "earned" and "spent" do not shrink as the list is trimmed.
     *
     * @param list<array<string, mixed>> $rows
     *
     * @return array{earned: int, spent: int}
     */
    public function totals(array $rows): array
    {
        $earned = Money::fromRupees(0);
        $spent = Money::fromRupees(0);

        foreach ($rows as $row) {
            $amount = Money::fromDecimalString((string) $row['amount']);

            if ((string) $row['direction'] === 'credit') {
                $earned = $earned->plus($amount);
            } else {
                $spent = $spent->plus($amount);
            }
        }

        return ['earned' => $earned->rupees(), 'spent' => $spent->rupees()];
    }
}
