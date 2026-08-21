<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;

/**
 * Voucher and Coupon (spec §7.6). Dates are ISO `YYYY-MM-DD` because that is
 * what a `<input type="date">` speaks, and `claimedOn`/`claimedOrder` are empty
 * strings rather than null so the record stays a flat map.
 */
final class VoucherPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function row(array $row): array
    {
        return [
            'code' => (string) $row['code'],
            'amount' => Money::fromDecimalString((string) $row['amount'])->rupees(),
            'returnId' => (string) $row['return_public_id'],
            'reason' => (string) $row['reason'],
            'customer' => (string) $row['customer_name'],
            'issuedOn' => (string) $row['issued_on'],
            'expiresOn' => (string) $row['expires_on'],
            'claimedOn' => (string) ($row['claimed_on'] ?? ''),
            'claimedOrder' => (string) ($row['claimed_order'] ?? ''),
        ];
    }

    /**
     * The console register adds the three derived columns it shows: whether it
     * is still spendable, where it came from, and what it was for.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function consoleRow(array $row): array
    {
        $claimed = ($row['claimed_on'] ?? null) !== null;
        $reason = trim((string) $row['reason']);
        $source = (string) $row['return_public_id'] !== ''
            ? sprintf('Return %s', $row['return_public_id'])
            : 'Issued by the store';

        return $this->row($row) + [
            'state' => $claimed ? 'Claimed' : 'Active',
            'source' => $source,
            'purpose' => $reason === '' ? $source : $reason,
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function consoleRows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->consoleRow($row), $rows);
    }

    /**
     * A voucher as the bag sees it: an amount coupon with no minimum, because
     * store credit the shop already owes cannot be made conditional on spending
     * more.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function asCoupon(array $row): array
    {
        $amount = Money::fromDecimalString((string) $row['amount'])->rupees();

        return [
            'code' => (string) $row['code'],
            'label' => sprintf('Return voucher · %s', Format::rupees(Money::fromRupees($amount))),
            'kind' => 'amount',
            'value' => $amount,
            'minSubtotal' => 0,
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function coupon(array $row): array
    {
        return [
            'code' => (string) $row['code'],
            'label' => (string) $row['label'],
            'kind' => (string) $row['kind'],
            'value' => Money::fromDecimalString((string) $row['value'])->rupees(),
            'minSubtotal' => Money::fromDecimalString((string) $row['min_subtotal'])->rupees(),
        ];
    }
}
