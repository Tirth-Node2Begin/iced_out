<?php

declare(strict_types=1);

namespace Iced\Presenter;

/**
 * ShipmentRow and the tracking payloads (spec §7.4, §7.5).
 *
 * The public tracking shape is deliberately narrow: token, order, carrier, AWB,
 * estimate, a city-and-PIN destination, and the events. No name, no street, no
 * phone, no payment — the page advertises that, and a contract test asserts it.
 */
final class ShipmentPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function row(array $row): array
    {
        if ($row === []) {
            return [];
        }

        $presented = [
            'id' => (string) $row['public_id'],
            'order' => (string) $row['order_number'],
            'provider' => (string) $row['provider'],
            'awb' => (string) $row['awb'],
            'destination' => (string) $row['destination'],
            'dispatched' => (string) $row['dispatched_label'],
            'promise' => (string) $row['promise_label'],
            'status' => (string) $row['status'],
        ];

        if (($row['fail_reason'] ?? null) !== null && (string) $row['fail_reason'] !== '') {
            $presented['reason'] = (string) $row['fail_reason'];
        }

        if (($row['handling'] ?? null) !== null && (string) $row['handling'] !== '') {
            $presented['handling'] = (string) $row['handling'];
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
     * @param list<array<string, mixed>> $events
     *
     * @return list<array{label: string, detail: string, time: string, complete: bool}>
     */
    public function events(array $events): array
    {
        return array_map(static fn (array $event): array => [
            'label' => (string) $event['label'],
            'detail' => (string) $event['detail'],
            'time' => (string) $event['time_label'],
            'complete' => (bool) $event['is_complete'],
        ], $events);
    }

    /**
     * TrackingFixture (spec §7.5). Carries NO customer PII by construction —
     * the only address field is the city-and-PIN string.
     *
     * @param array<string, mixed>       $shipment
     * @param list<array<string, mixed>> $events
     *
     * @return array<string, mixed>
     */
    public function tracking(array $shipment, array $events): array
    {
        return [
            'token' => (string) $shipment['tracking_token'],
            'order' => (string) $shipment['order_number'],
            'status' => match ((string) $shipment['status']) {
                'Delivered' => 'Delivered',
                'In transit', 'Dispatched' => 'In transit',
                default => 'Processing',
            },
            'carrier' => (string) $shipment['provider'],
            'awb' => (string) $shipment['awb'],
            'estimate' => (string) $shipment['promise_label'],
            'destination' => (string) $shipment['destination'],
            'events' => $this->events($events),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function pickup(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'provider' => (string) $row['provider'],
            'parcels' => str_pad((string) (int) $row['parcels'], 2, '0', STR_PAD_LEFT),
            'pickup' => (string) $row['pickup_label'],
            'status' => (string) $row['status'],
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function pickups(array $rows): array
    {
        return array_map(fn (array $row): array => $this->pickup($row), $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function ndrCases(array $rows): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'order' => (string) $row['order_number'],
            'provider' => (string) $row['provider'],
            'destination' => (string) $row['destination'],
            'reason' => (string) $row['reason'],
            'attempts' => (string) (int) $row['attempts'],
            'status' => (string) $row['status'],
            'handling' => (string) ($row['handling'] ?? ''),
        ], $rows);
    }
}
