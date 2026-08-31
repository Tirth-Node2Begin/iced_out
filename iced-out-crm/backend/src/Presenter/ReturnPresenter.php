<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;

/**
 * AdminReturnRow (spec §7.4) and the customer's ReturnFixture (§7.6).
 *
 * The exchange balance is computed from the LIVE catalogue price of the
 * replacement, never from a stored copy: a replacement is priced at what it
 * sells for today, not at what something else sold for last month.
 */
final class ReturnPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function adminRow(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'order' => (string) $row['order_number'],
            'customer' => (string) $row['customer_name'],
            'item' => (string) $row['item_label'],
            'reason' => (string) $row['reason'],
            'outcome' => (string) $row['outcome'],
            'amount' => Format::plainAmount(Money::fromDecimalString((string) $row['amount'])),
            'replacement' => (string) $row['replacement_label'],
            'state' => (string) $row['state'],
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function adminRows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->adminRow($row), $rows);
    }

    /**
     * What the store still has to collect, or still owes, on an exchange.
     *
     * @param array<string, mixed> $row
     *
     * @return array{direction: string, amount: int}
     */
    public function balance(array $row): array
    {
        if ((string) $row['outcome'] !== 'Exchange' || ($row['replacement_price'] ?? null) === null) {
            return ['direction' => 'even', 'amount' => 0];
        }

        $replacement = Money::fromDecimalString((string) $row['replacement_price'])->rupees();
        $returned = Money::fromDecimalString((string) $row['amount'])->rupees();
        $difference = $replacement - $returned;

        if ($difference > 0) {
            return ['direction' => 'collect', 'amount' => $difference];
        }

        if ($difference < 0) {
            return ['direction' => 'credit', 'amount' => -$difference];
        }

        return ['direction' => 'even', 'amount' => 0];
    }

    /**
     * The customer's own view — a different, shorter record than the console's.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function customerRow(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'order' => (string) $row['order_number'],
            'item' => (string) $row['item_label'],
            'variant' => (string) $row['item_label'],
            'outcome' => (string) $row['outcome'],
            'amount' => Money::fromDecimalString((string) $row['amount'])->rupees(),
            'replacement' => (string) $row['replacement_label'],
            'destination' => (string) $row['destination'],
            'status' => (string) $row['customer_status'],
            'reference' => (string) $row['reference'],
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function customerRows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->customerRow($row), $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function history(array $rows): array
    {
        return array_map(static function (array $row): array {
            $at = Format::parse((string) $row['created_at']);

            return [
                'from' => (string) $row['from_state'],
                'to' => (string) $row['to_state'],
                'note' => (string) $row['note'],
                'at' => $at === null ? '' : Format::ledgerStamp($at),
            ];
        }, $rows);
    }
}
