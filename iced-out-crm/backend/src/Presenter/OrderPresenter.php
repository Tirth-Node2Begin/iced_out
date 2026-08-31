<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;
use Iced\Support\Clock;

/**
 * AdminOrderRow (spec §7.4) — **every value is a string**, because the console
 * register renders flat string maps and an adapter between the two is exactly
 * the seam where a row starts disagreeing with its record.
 *
 * `age` is recomputed here on every read rather than stored: an age written to
 * a column is wrong one minute later.
 */
final class OrderPresenter
{
    /** The register speaks "Pending" where the payments ledger says "Due". */
    private const PAYMENT_LABEL = [
        'Captured' => 'Captured',
        'Due' => 'Pending',
        'Failed' => 'Failed',
        'Refunded' => 'Refunded',
    ];

    public function __construct(private readonly Clock $clock)
    {
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function row(array $row): array
    {
        $placedAt = Format::parse(isset($row['placed_at']) ? (string) $row['placed_at'] : null);
        $paymentStatus = (string) ($row['payment_status'] ?? 'Due');

        $presented = [
            'id' => (string) $row['number'],
            'customer' => (string) $row['contact_name'],
            'items' => (string) (int) ($row['piece_count'] ?? 0),
            'value' => Format::plainAmount(Money::fromDecimalString((string) $row['total'])),
            'payment' => self::PAYMENT_LABEL[$paymentStatus] ?? 'Pending',
            'method' => (string) ($row['payment_method'] ?? 'Cash on delivery'),
            'status' => (string) $row['console_state'],
            'destination' => (string) $row['addr_city'],
            'age' => $placedAt === null ? '' : Format::age($placedAt, $this->clock->now()),
        ];

        // Only a cancelled order carries who called it off.
        if (($row['cancelled_by'] ?? null) !== null && (string) $row['cancelled_by'] !== '') {
            $presented['cancelledBy'] = (string) $row['cancelled_by'];
        }

        return $presented;
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
     * Detail lines. Unlike the register row these carry a numeric price — the
     * detail screen does arithmetic on them.
     *
     * @param list<array<string, mixed>> $lines
     *
     * @return list<array<string, mixed>>
     */
    public function lines(array $lines): array
    {
        return array_map(static fn (array $line): array => [
            'productId' => (string) ($line['product_slug'] ?? ''),
            'name' => (string) $line['name'],
            'size' => (string) $line['size'],
            'qty' => (int) $line['quantity'],
            'price' => Money::fromDecimalString((string) $line['unit_price'])->rupees(),
        ], $lines);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array{label: string, at: string, actor: string, note: string}>
     */
    public function timeline(array $rows): array
    {
        return array_map(static function (array $row): array {
            $at = Format::parse((string) $row['created_at']);

            return [
                'label' => (string) $row['to_status'],
                'at' => $at === null ? '' : Format::ledgerStamp($at),
                'actor' => (string) $row['actor_type'],
                'note' => (string) $row['note'],
            ];
        }, $rows);
    }

    /**
     * The customer's own order history on the console customer page —
     * a different, shorter shape than the register row (spec §8.26 #157).
     *
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function customerHistory(array $rows): array
    {
        return array_map(static function (array $row): array {
            $placed = Format::parse((string) $row['placed_at']);

            return [
                'id' => (string) $row['number'],
                'placed' => $placed === null ? '' : Format::shortDate($placed),
                'pieces' => (string) (int) ($row['piece_count'] ?? 0),
                'value' => Format::rupees(Money::fromDecimalString((string) $row['total'])),
                'status' => match ((string) $row['status']) {
                    'Delivered' => 'Delivered',
                    'Cancelled' => 'Cancelled',
                    default => 'In fulfilment',
                },
            ];
        }, $rows);
    }
}
