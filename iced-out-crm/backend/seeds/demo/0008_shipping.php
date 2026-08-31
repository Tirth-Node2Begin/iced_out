<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * Shipments, their timelines, and the courier pickups — from
 * `17-shipping/data/shipment-fixtures.ts` and the pickups table in
 * `shipment-workspace.tsx`.
 *
 * Every event seeded here is `source = 'internal'`: these are the store's own
 * dispatch and delivery milestones. Courier scans come from the external
 * tracking API and are cached with `source = 'external'` — until that provider
 * is connected the tail is simply empty (spec §9.8).
 *
 * The two demo tracking tokens are the pre-rendered ones (spec §11), so
 * /track/track-1048-demo and /track/track-1027-demo resolve on the static export.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var Clock $clock */
    $clock = $container->get(Clock::class);

    $shipments = [
        [
            'id' => 'shp-1045', 'order' => 'IO-2026-1045', 'provider' => 'Blue Dart', 'awb' => '••••1045',
            'destination' => 'Bengaluru 560001', 'dispatched' => '05 Aug', 'promise' => '08–09 Aug',
            'status' => 'In transit', 'token' => 'track-1045', 'handling' => null, 'reason' => null,
            'events' => [
                ['Order placed', 'We have your order.', '04 Aug, 13:36', true],
                ['Packed', 'Picked and packed at BLR-01.', '05 Aug, 09:10', true],
                ['Dispatched', 'Handed to Blue Dart.', '05 Aug, 17:30', true],
                ['In transit', 'Moving towards Bengaluru.', '06 Aug, 06:22', true],
                ['Out for delivery', 'Expected 08–09 Aug.', '', false],
                ['Delivered', '', '', false],
            ],
        ],
        [
            'id' => 'shp-1044', 'order' => 'IO-2026-1044', 'provider' => 'Delhivery', 'awb' => '••••7714',
            'destination' => 'Pune 411001', 'dispatched' => '04 Aug', 'promise' => '05 Aug',
            'status' => 'Delivered', 'token' => 'track-1044', 'handling' => null, 'reason' => null,
            'events' => [
                ['Order placed', 'We have your order.', '03 Aug, 18:04', true],
                ['Packed', 'Picked and packed at BLR-01.', '04 Aug, 08:40', true],
                ['Dispatched', 'Handed to Delhivery.', '04 Aug, 16:00', true],
                ['In transit', 'Moving towards Pune.', '04 Aug, 22:15', true],
                ['Delivered', 'Signed for at the door.', '05 Aug, 11:48', true],
            ],
        ],
        [
            'id' => 'shp-1039', 'order' => 'IO-2026-1039', 'provider' => 'Ecom Express', 'awb' => '••••2280',
            'destination' => 'Kolkata 700001', 'dispatched' => '03 Aug', 'promise' => '06 Aug',
            'status' => 'Failed', 'token' => 'track-1039', 'handling' => 'Needs action', 'reason' => 'Nobody was home',
            'events' => [
                ['Order placed', 'We have your order.', '02 Aug, 09:20', true],
                ['Dispatched', 'Handed to Ecom Express.', '03 Aug, 15:10', true],
                ['In transit', 'Moving towards Kolkata.', '04 Aug, 07:02', true],
                ['Delivery attempted', 'Nobody was home.', '06 Aug, 12:30', true],
            ],
        ],
        [
            'id' => 'shp-1048', 'order' => 'IO-2026-1048', 'provider' => 'Blue Dart', 'awb' => 'IOL84639201',
            'destination' => 'Bengaluru 560001', 'dispatched' => '', 'promise' => '17 – 19 Aug',
            'status' => 'Dispatched', 'token' => 'track-1048-demo', 'handling' => null, 'reason' => null,
            'events' => [
                ['Order placed', 'We have your order.', '', true],
                ['Packed', 'Picked and packed at BLR-01.', '', true],
                ['Dispatched', 'Handed to Blue Dart.', '', true],
                ['In transit', '', '', false],
                ['Out for delivery', '', '', false],
                ['Delivered', '', '', false],
            ],
        ],
        [
            'id' => 'shp-1027', 'order' => 'IO-2026-1027', 'provider' => 'Blue Dart', 'awb' => 'IOL71120044',
            'destination' => 'Bengaluru 560001', 'dispatched' => '23 Jul', 'promise' => '25–26 Jul',
            'status' => 'Delivered', 'token' => 'track-1027-demo', 'handling' => null, 'reason' => null,
            'events' => [
                ['Order placed', 'We have your order.', '22 Jul, 10:05', true],
                ['Packed', 'Picked and packed at BLR-01.', '23 Jul, 08:30', true],
                ['Dispatched', 'Handed to Blue Dart.', '23 Jul, 17:30', true],
                ['In transit', 'Moving towards Bengaluru.', '24 Jul, 06:40', true],
                ['Delivered', 'Signed for at the door.', '25 Jul, 12:12', true],
            ],
        ],
    ];

    $pickups = [
        ['PICK-0412', 'Blue Dart', 18, '05 Aug · 17:30', 'Open'],
        ['PICK-0411', 'Delhivery', 9, '05 Aug · 16:00', 'Handed over'],
        ['PICK-0410', 'Ecom Express', 4, '04 Aug · 17:00', 'Handed over'],
    ];

    return $db->transaction(static function (Database $db) use ($shipments, $pickups, $clock): string {
        $orderIds = [];

        foreach ($db->select('SELECT id, number FROM orders') as $row) {
            $orderIds[(string) $row['number']] = (int) $row['id'];
        }

        $eventCount = 0;

        foreach ($shipments as $shipment) {
            $orderId = $orderIds[$shipment['order']] ?? null;

            if ($orderId === null) {
                continue;
            }

            $db->statement(
                'INSERT INTO shipments
                    (public_id, order_id, order_number, provider, awb, destination, dispatched_label,
                     promise_label, status, fail_reason, handling, tracking_token)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    provider = VALUES(provider), awb = VALUES(awb), destination = VALUES(destination),
                    dispatched_label = VALUES(dispatched_label), promise_label = VALUES(promise_label),
                    status = VALUES(status), fail_reason = VALUES(fail_reason), handling = VALUES(handling)',
                [
                    $shipment['id'], $orderId, $shipment['order'], $shipment['provider'], $shipment['awb'],
                    $shipment['destination'], $shipment['dispatched'], $shipment['promise'],
                    $shipment['status'], $shipment['reason'], $shipment['handling'], $shipment['token'],
                ],
            );

            $row = $db->selectOne('SELECT id FROM shipments WHERE public_id = ?', [$shipment['id']]);

            if ($row === null) {
                continue;
            }

            $shipmentId = (int) $row['id'];

            $db->statement("DELETE FROM shipment_events WHERE shipment_id = ? AND source = 'internal'", [$shipmentId]);

            foreach ($shipment['events'] as $position => $event) {
                $db->statement(
                    'INSERT INTO shipment_events (shipment_id, label, detail, time_label, is_complete, position, source, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, \'internal\', ?)',
                    [$shipmentId, $event[0], $event[1], $event[2], $event[3] ? 1 : 0, $position, $clock->nowString()],
                );
                ++$eventCount;
            }

            // A failed parcel opens an NDR case — the attempt counter the resend
            // guard reads (max 3, spec §9.4).
            if ($shipment['status'] === 'Failed') {
                $db->statement(
                    'INSERT INTO ndr_cases (shipment_id, reason, attempts, status) VALUES (?, ?, 1, \'Open\')
                     ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
                    [$shipmentId, (string) $shipment['reason']],
                );
            }
        }

        foreach ($pickups as $pickup) {
            [$code, $provider, $parcels, $label, $status] = $pickup;

            $db->statement(
                'INSERT INTO courier_pickups (public_id, provider, parcels, pickup_label, status)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE parcels = VALUES(parcels), pickup_label = VALUES(pickup_label), status = VALUES(status)',
                [$code, $provider, $parcels, $label, $status],
            );
        }

        return sprintf('%d shipments (%d events), %d pickups', count($shipments), $eventCount, count($pickups));
    });
};
