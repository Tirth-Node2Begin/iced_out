<?php

declare(strict_types=1);

/**
 * A populated material flow, for looking at the screens with something on them.
 *
 * OPT-IN, like everything else under seeds/demo/. It seeds the UPSTREAM state a
 * real shop would be in a few weeks after starting: two suppliers, six
 * materials with stock received against real purchase orders, recipes on the
 * catalogue's own items, and one run part-way through.
 *
 * Stock is put in by RECEIVING a purchase order rather than by writing
 * `on_hand` directly — so every quantity here has a ledger row behind it, the
 * same as it would in production. Seeding the column would produce a register
 * whose history starts with an inexplicable jump.
 *
 * Idempotent: it does nothing if materials already exist.
 *
 *   php seeds/demo/materials.php
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Repository\MaterialRepository;
use Iced\Repository\ProductionRepository;
use Iced\Service\Inventory\MaterialService;

$app = Application::boot($root);
$db = $app->container->make(Database::class);
$materials = $app->container->make(MaterialRepository::class);
$production = $app->container->make(ProductionRepository::class);
$stock = $app->container->make(MaterialService::class);

$out = static fn (string $line): int => print($line . PHP_EOL);

if ($db->selectOne('SELECT id FROM materials WHERE deleted_at IS NULL LIMIT 1') !== null) {
    $out('Materials already exist — nothing seeded.');
    exit(0);
}

$admin = $db->selectOne('SELECT id FROM users WHERE type = ? ORDER BY id LIMIT 1', ['STAFF']);
$actor = $admin === null ? null : (int) $admin['id'];

$warehouse = $db->selectOne('SELECT id FROM warehouses ORDER BY id LIMIT 1');
$warehouseId = $warehouse === null ? null : (int) $warehouse['id'];

/* ---------------------------------------------------------------- suppliers */
$suppliers = [];

foreach ([
    ['Kanchi Mills', 'S. Raman', 'orders@kanchimills.example', 'Coimbatore', 21],
    ['Northline Trims', 'A. Bose', 'hello@northlinetrims.example', 'Ludhiana', 7],
] as [$name, $contact, $email, $city, $lead]) {
    $suppliers[$name] = $materials->createSupplier([
        'name' => $name,
        'contactName' => $contact,
        'email' => $email,
        'phone' => '',
        'city' => $city,
        'country' => 'India',
        'leadTimeDays' => $lead,
        'notes' => '',
    ])['id'];
}

$out(sprintf('  + %d suppliers', count($suppliers)));

/* ---------------------------------------------------------------- materials */
$made = [];

foreach ([
    ['FLC-520', '520 GSM brushed fleece', 'FABRIC', 'M', 60, 640, 'Kanchi Mills'],
    ['TWL-340', '340 GSM cotton twill', 'FABRIC', 'M', 40, 420, 'Kanchi Mills'],
    ['WOL-740', '740 GSM pressed wool', 'FABRIC', 'M', 25, 1850, 'Kanchi Mills'],
    ['CRD-4MM', '4 mm flat drawcord', 'TRIM', 'M', 200, 11, 'Northline Trims'],
    ['ZIP-YKK', 'YKK #5 metal zip, 62 cm', 'HARDWARE', 'PC', 80, 96, 'Northline Trims'],
    ['LBL-WOV', 'Woven neck label', 'LABEL', 'PC', 300, 7, 'Northline Trims'],
] as [$code, $name, $kind, $unit, $reorder, $cost, $supplier]) {
    $made[$code] = $materials->create([
        'code' => $code,
        'name' => $name,
        'kind' => $kind,
        'unit' => $unit,
        'reorderPoint' => number_format((float) $reorder, 3, '.', ''),
        'unitCost' => number_format((float) $cost, 2, '.', ''),
        'supplierId' => $suppliers[$supplier],
        'warehouseId' => $warehouseId,
        'notes' => '',
    ]);
}

$out(sprintf('  + %d materials', count($made)));

/* ---------------------------------------------------------------- purchases */
/**
 * Two orders, and they are deliberately in different states:
 *
 *   the fabric order   fully received — the shelf has stock and the ledger says
 *                      where it came from
 *   the trims order    part received — one line short, so the register shows an
 *                      order still owed something, which is the state an
 *                      operator most needs the screen to make obvious
 */
$db->transaction(function () use ($db, $materials, $production, $stock, $suppliers, $made, $actor): void {
    $fabric = $production->createPurchase($suppliers['Kanchi Mills'], date('Y-m-d', strtotime('+1 week')), 'AW cut', $actor);

    foreach ([['FLC-520', 480, 640], ['TWL-340', 260, 420], ['WOL-740', 90, 1850]] as [$code, $qty, $cost]) {
        $production->setPurchaseLine(
            $fabric['id'],
            $made[$code]['id'],
            number_format((float) $qty, 3, '.', ''),
            number_format((float) $cost, 2, '.', ''),
        );
    }

    $production->updatePurchase($fabric['id'], ['status' => 'ORDERED', 'ordered_on' => date('Y-m-d', strtotime('-12 days'))]);

    foreach ([['FLC-520', 480], ['TWL-340', 260], ['WOL-740', 90]] as [$code, $qty]) {
        $stock->receive(
            $made[$code]['id'],
            number_format((float) $qty, 3, '.', ''),
            'purchase',
            $fabric['publicId'],
            null,
            $actor,
        );
        $production->addReceived($fabric['id'], $made[$code]['id'], number_format((float) $qty, 3, '.', ''));
    }

    $production->updatePurchase($fabric['id'], ['status' => 'RECEIVED', 'received_on' => date('Y-m-d', strtotime('-3 days'))]);

    /* ---- the trims order, one line short ---- */
    $trims = $production->createPurchase($suppliers['Northline Trims'], date('Y-m-d', strtotime('+3 days')), '', $actor);

    foreach ([['CRD-4MM', 900, 11], ['ZIP-YKK', 300, 96], ['LBL-WOV', 1200, 7]] as [$code, $qty, $cost]) {
        $production->setPurchaseLine(
            $trims['id'],
            $made[$code]['id'],
            number_format((float) $qty, 3, '.', ''),
            number_format((float) $cost, 2, '.', ''),
        );
    }

    $production->updatePurchase($trims['id'], ['status' => 'ORDERED', 'ordered_on' => date('Y-m-d', strtotime('-4 days'))]);

    /* The zips are short — 180 of the 300 turned up. */
    foreach ([['CRD-4MM', 900], ['ZIP-YKK', 180], ['LBL-WOV', 1200]] as [$code, $qty]) {
        $stock->receive(
            $made[$code]['id'],
            number_format((float) $qty, 3, '.', ''),
            'purchase',
            $trims['publicId'],
            null,
            $actor,
        );
        $production->addReceived($trims['id'], $made[$code]['id'], number_format((float) $qty, 3, '.', ''));
    }

    $production->updatePurchase($trims['id'], ['status' => 'PARTIAL']);
});

$out('  + 2 purchase orders (one fully received, one part)');

/* ------------------------------------------------------------------ recipes */
/**
 * Recipes on whatever the catalogue actually holds, matched by what the piece
 * IS rather than by name — the demo catalogue is not guaranteed to contain any
 * particular garment, and a seed that assumed one would fail on a fresh install.
 */
$items = $db->select('SELECT id, item_name, category FROM stock_items WHERE deleted_at IS NULL ORDER BY id LIMIT 6');
$recipes = 0;

foreach ($items as $item) {
    $top = (string) $item['category'] === 'Top';

    /* A top is fleece plus a cord and a label; a bottom is twill plus a zip and
       a label. Both are plausible, and both draw on more than one material,
       which is what makes the run screen worth looking at. */
    $lines = $top
        ? [['FLC-520', '2.4000', '5.00'], ['CRD-4MM', '1.2000', '0.00'], ['LBL-WOV', '1.0000', '0.00']]
        : [['TWL-340', '1.9000', '6.00'], ['ZIP-YKK', '1.0000', '0.00'], ['LBL-WOV', '1.0000', '0.00']];

    foreach ($lines as [$code, $per, $waste]) {
        $materials->setRecipeLine((int) $item['id'], $made[$code]['id'], $per, $waste, '');
    }

    ++$recipes;
}

$out(sprintf('  + %d recipes', $recipes));

/* --------------------------------------------------------------------- runs */
if ($items !== []) {
    $first = $items[0];

    /* One planned and one already in production, so both halves of the state
       machine have something on screen the first time it is opened. */
    foreach ([[60, 'PLANNED'], [40, 'STARTED']] as [$qty, $state]) {
        $run = $production->createRun((int) $first['id'], $warehouseId, $qty, '', $actor);

        foreach ($materials->recipe((int) $first['id']) as $line) {
            $production->snapshotRecipe(
                $run['id'],
                (int) $line['material_id'],
                (string) $line['qty_per_unit'],
                (string) $line['wastage_pct'],
            );
        }

        if ($state === 'STARTED') {
            $db->transaction(function () use ($production, $stock, $run, $qty, $actor): void {
                foreach ($production->runLines($run['id']) as $line) {
                    $needed = \Iced\Presenter\MaterialPresenter::required(
                        (string) $line['qty_per_unit'],
                        (string) $line['wastage_pct'],
                        $qty,
                    );

                    $stock->reserve((int) $line['material_id'], $needed, 'production', $run['publicId'], $actor);
                    $production->setRunLineQty($run['id'], (int) $line['material_id'], 'qty_reserved', $needed);
                }

                $production->updateRun($run['id'], ['status' => 'STARTED', 'started_at' => gmdate('Y-m-d H:i:s') . '.000000']);
            });
        }
    }

    $out('  + 2 production runs (one planned, one in production)');
}

$out('Demo material flow seeded.');
