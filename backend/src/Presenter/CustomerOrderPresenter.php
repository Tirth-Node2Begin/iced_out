<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;

/**
 * OrderRecord (spec §7.3) — the shopper's own view of an order.
 *
 * A different shape from the console's AdminOrderRow on purpose: this one is
 * typed, carries the lines and the parcel, and speaks in money strings the
 * account screens print directly. Same rows underneath, two audiences.
 */
final class CustomerOrderPresenter
{
    /**
     * The account screens have three payment words, not the ledger's four.
     * A refunded payment WAS captured — the refund is its own record — so it
     * reads as captured here rather than inventing a fourth state the UI has
     * no copy for.
     */
    private const PAYMENT_STATUS = [
        'Captured' => 'Captured',
        'Refunded' => 'Captured',
        'Due' => 'Due on delivery',
        'Failed' => 'Failed',
    ];

    /**
     * @param array<string, mixed>       $order
     * @param list<array<string, mixed>> $lines
     * @param array<string, mixed>|null  $payment
     * @param array<string, mixed>|null  $shipment
     *
     * @return array<string, mixed>
     */
    public function record(array $order, array $lines, ?array $payment, ?array $shipment): array
    {
        $placed = Format::parse((string) $order['placed_at']);
        $status = (string) $order['status'];

        return [
            'id' => (string) $order['public_id'],
            'number' => (string) $order['number'],
            'date' => $placed === null ? '' : Format::longDate($placed),
            'total' => Format::rupees(Money::fromDecimalString((string) $order['total'])),
            // The customer never sees "Cancelled" as an order status here — a
            // cancelled order is shown by the console; this projection has three.
            'status' => in_array($status, ['Processing', 'Delivered', 'Payment failed'], true)
                ? $status
                : 'Processing',
            'items' => (string) ($order['items_summary'] ?? ''),
            'lines' => $this->lines($lines),
            'payment' => $this->payment($payment),
            'shipment' => $this->shipment($shipment),
            'cancellationEligible' => (bool) $order['cancellation_eligible'],
        ];
    }

    /**
     * @param list<array<string, mixed>> $lines
     *
     * @return list<array<string, mixed>>
     */
    private function lines(array $lines): array
    {
        return array_map(static fn (array $line): array => [
            'id' => (string) $line['line_public_id'],
            'name' => (string) $line['name'],
            'variant' => (string) $line['variant_label'],
            'quantity' => (int) $line['quantity'],
            'price' => Format::rupees(Money::fromDecimalString((string) $line['unit_price'])),
            // Only a delivered line that has not already come back can be returned.
            'returnEligible' => (bool) $line['return_eligible']
                && (int) $line['returned_qty'] < (int) $line['quantity'],
        ], $lines);
    }

    /**
     * @param array<string, mixed>|null $payment
     *
     * @return array<string, mixed>
     */
    private function payment(?array $payment): array
    {
        if ($payment === null) {
            return ['method' => 'Cash on delivery', 'status' => 'Due on delivery', 'reference' => ''];
        }

        $record = [
            'method' => (string) $payment['method'],
            'status' => self::PAYMENT_STATUS[(string) $payment['status']] ?? 'Due on delivery',
            // Never the gateway's full reference — the tail is enough to quote.
            'reference' => self::maskReference((string) $payment['public_id']),
        ];

        if ((string) $payment['note'] !== '') {
            $record['note'] = (string) $payment['note'];
        }

        return $record;
    }

    /**
     * @param array<string, mixed>|null $shipment
     *
     * @return array<string, string>
     */
    private function shipment(?array $shipment): array
    {
        if ($shipment === null) {
            return ['token' => '', 'service' => 'Standard delivery', 'awb' => '', 'destination' => '', 'estimate' => ''];
        }

        return [
            'token' => (string) $shipment['tracking_token'],
            'service' => (string) $shipment['provider'],
            'awb' => 'AWB ' . self::maskTail((string) $shipment['awb']),
            'destination' => (string) $shipment['destination'],
            'estimate' => (string) $shipment['promise_label'],
        ];
    }

    private static function maskReference(string $reference): string
    {
        return $reference === '' ? '' : 'pay_' . self::maskTail($reference);
    }

    private static function maskTail(string $value): string
    {
        return strlen($value) <= 4 ? $value : '••••' . substr($value, -4);
    }
}
