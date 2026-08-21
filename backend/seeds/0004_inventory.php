<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;

/**
 * Where stock lives and what stock there is — the warehouses and every ITM-* item.
 *
 * This is product master data, not trading history: `products.item_ref` points at
 * `stock_items.public_id`, so nothing in the catalogue can be listed until these
 * rows exist. Transfers between warehouses ARE trading history and live in
 * seeds/demo/.
 *
 * The items come from `seeds/data/catalogue.php` — one list, shared with the
 * catalog seed that lists them. Two lists would drift the moment somebody edited
 * one, and a product listed from an item that does not exist is a row no screen
 * can render.
 *
 * Runs before the catalog seed for that reason.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);

    /** @var list<array<string, mixed>> $catalogue */
    $catalogue = require __DIR__ . '/data/catalogue.php';

    $warehouses = [
        ['BLR-01', 'Bengaluru fulfilment centre', 82, '18:00 · Blue Dart', 'Online'],
        ['DEL-01', 'Delhi regional node', 61, '17:30 · Delhivery', 'Online'],
        ['MUM-01', 'Mumbai overflow', 24, '16:00 · Ecom Express', 'Draft'],
    ];

    return $db->transaction(static function (Database $db) use ($warehouses, $catalogue): string {
        foreach ($warehouses as $warehouse) {
            [$code, $name, $capacity, $cutoff, $status] = $warehouse;

            /* `available_label` is not seeded any more: it is what the node holds,
               which the presenter counts from the stock items in it. A stored
               label was a number that could disagree with the items under it. */
            $db->statement(
                'INSERT INTO warehouses (public_id, name, available_label, capacity_pct, cutoff, status)
                 VALUES (?, ?, \'\', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    name = VALUES(name), capacity_pct = VALUES(capacity_pct),
                    cutoff = VALUES(cutoff), status = VALUES(status)',
                [$code, $name, $capacity, $cutoff, $status],
            );
        }

        $warehouseIds = [];

        foreach ($db->select('SELECT id, public_id FROM warehouses') as $row) {
            $warehouseIds[(string) $row['public_id']] = (int) $row['id'];
        }

        foreach ($catalogue as $piece) {
            /* `reserved_units` is deliberately never written here. What is reserved
               is the sum of what orders are holding, which checkout and fulfilment
               move — seeding stock as already spoken for made the console show
               units held against orders that did not exist. */
            $db->statement(
                'INSERT INTO stock_items
                    (public_id, item_name, category, audience, item_type, sizes_csv, warehouse_id, total_units, reserved_units)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                 ON DUPLICATE KEY UPDATE
                    item_name = VALUES(item_name), category = VALUES(category), audience = VALUES(audience),
                    item_type = VALUES(item_type), sizes_csv = VALUES(sizes_csv),
                    warehouse_id = VALUES(warehouse_id), total_units = VALUES(total_units)',
                [
                    $piece['item'],
                    $piece['name'],
                    $piece['kind'],
                    /* The garment is what is cut for men or women; the product
                       listed from it inherits this. One fact, described once. */
                    $piece['audience'],
                    $piece['type'],
                    implode(', ', $piece['sizes']),
                    $warehouseIds[$piece['warehouse']] ?? null,
                    $piece['units'],
                ],
            );
        }

        return sprintf('%d warehouses, %d stock items', count($warehouses), count($catalogue));
    });
};
