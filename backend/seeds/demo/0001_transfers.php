<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;

/**
 * The TRF-* stock transfers behind `03-inventory/components/inventory-operations.tsx`.
 *
 * Demo data: a transfer is a movement somebody ordered, so a fresh install has
 * none. The warehouses and stock items they move between are seeded for real —
 * see seeds/0004_inventory.php — because the catalogue cannot exist without them.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);

    $transfers = [
        ['TRF-084', 'BLR-01', 'DEL-01', 48, '05 Aug', 'In transit'],
        ['TRF-083', 'BLR-01', 'MUM-01', 22, '05 Aug', 'Ready'],
        ['TRF-081', 'DEL-01', 'BLR-01', 6, '03 Aug', 'Received'],
    ];

    return $db->transaction(static function (Database $db) use ($transfers): string {
        $warehouseIds = [];

        foreach ($db->select('SELECT id, public_id FROM warehouses') as $row) {
            $warehouseIds[(string) $row['public_id']] = (int) $row['id'];
        }

        foreach ($transfers as $transfer) {
            [$code, $from, $to, $units, $dispatched, $status] = $transfer;

            $db->statement(
                'INSERT INTO inventory_transfers
                    (public_id, from_warehouse_id, to_warehouse_id, units, dispatched_label, status)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    units = VALUES(units), dispatched_label = VALUES(dispatched_label), status = VALUES(status)',
                [$code, $warehouseIds[$from] ?? null, $warehouseIds[$to] ?? null, $units, $dispatched, $status],
            );
        }

        return sprintf('%d transfers', count($transfers));
    });
};
