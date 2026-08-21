<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;

/**
 * PaymentRow, RefundRow, PayoutRow (spec §7.4).
 *
 * A payout's `net` is always derived — max(0, gross − fees) — never stored, so
 * the column cannot drift from the two it comes from.
 * Customer names are already masked in storage: this console never needs the
 * whole name to do the job, so it never holds one.
 */
final class PaymentPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function row(array $row): array
    {
        $created = Format::parse((string) $row['created_at']);

        return [
            'id' => (string) $row['public_id'],
            'order' => (string) $row['order_number'],
            'customer' => (string) $row['customer_masked'],
            'gateway' => (string) $row['gateway'],
            'method' => (string) $row['method'],
            'amount' => Format::plainAmount(Money::fromDecimalString((string) $row['amount'])),
            'status' => (string) $row['status'],
            'note' => (string) $row['note'],
            'reference' => (string) $row['reference'],
            'created' => $created === null ? '' : Format::ledgerStamp($created),
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function rows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->row($row), $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function refundRows(array $rows): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'payment' => (string) $row['payment_public_id'],
            'order' => (string) $row['order_number'],
            'amount' => Format::plainAmount(Money::fromDecimalString((string) $row['amount'])),
            'reason' => (string) $row['reason'],
            'status' => (string) $row['status'],
        ], $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function payoutRows(array $rows): array
    {
        return array_map(static function (array $row): array {
            $gross = Money::fromDecimalString((string) $row['gross']);
            $fees = Money::fromDecimalString((string) $row['fees']);

            return [
                'id' => (string) $row['public_id'],
                'gateway' => (string) $row['gateway'],
                'period' => (string) $row['period_label'],
                'gross' => Format::plainAmount($gross),
                'fees' => Format::plainAmount($fees),
                'net' => Format::plainAmount($gross->minus($fees)->atLeastZero()),
                'status' => (string) $row['status'],
            ];
        }, $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function timeline(array $rows): array
    {
        return array_map(static function (array $row): array {
            $at = Format::parse((string) $row['created_at']);

            return [
                'label' => (string) $row['operation'],
                'detail' => (string) $row['outcome'],
                'at' => $at === null ? '' : Format::ledgerStamp($at),
            ];
        }, $rows);
    }
}
