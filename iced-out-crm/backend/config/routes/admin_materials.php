<?php

declare(strict_types=1);

use Iced\Controller\Console\MaterialController;
use Iced\Kernel\Route;

/**
 * The raw-material flow: suppliers → purchases → materials → recipes → runs.
 *
 * Permissions are the INVENTORY ones, not a new pair. This is inventory — the
 * half of it that exists before a garment does — and an operator trusted to
 * adjust a count of finished hoodies is trusted to adjust the fleece they were
 * cut from. A separate code would only be a second thing to forget to grant.
 *
 *   inventory.view      read anything here
 *   inventory.adjust    change a quantity, a recipe, or a run
 *
 * OPTIONAL STRING FIELDS CARRY `nullable`. Without it the validator drops a
 * present-but-empty value and a PATCH that clears a field silently does nothing
 * — see Iced\Support\Validator.
 */

$read = static fn (string $path, string $method, string $name): array => [
    'method' => 'GET',
    'path' => $path,
    'handler' => [MaterialController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'inventory.view',
    'rate_limit' => 'console_read',
    'name' => $name,
];

/** @param array<string, string> $rules */
$write = static fn (string $verb, string $path, string $method, string $name, array $rules = []): array => [
    'method' => $verb,
    'path' => $path,
    'handler' => [MaterialController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'inventory.adjust',
    'rate_limit' => 'console_write',
    'name' => $name,
    'rules' => $rules,
    'audit' => true,
];

$KIND = 'nullable|string|in:FABRIC,TRIM,HARDWARE,LABEL,PACKAGING,OTHER';
$UNIT = 'nullable|string|in:M,CM,PC,KG,G,L,ROLL,SET';

return [
    // ------------------------------------------------------------ materials
    $read('/admin/inventory/materials', 'index', 'admin.inventory.materials.index'),
    $read('/admin/inventory/materials/{material}', 'show', 'admin.inventory.materials.show'),

    $write('POST', '/admin/inventory/materials', 'store', 'admin.inventory.materials.create', [
        'name' => 'required|string|min:2|max:160',
        'code' => 'nullable|string|max:40',
        'kind' => $KIND,
        'unit' => $UNIT,
        'reorderPoint' => 'nullable|number|min:0',
        'unitCost' => 'nullable|number|min:0',
        'supplier' => 'nullable|string|max:16',
        'warehouse' => 'nullable|string|max:16',
        'notes' => 'nullable|string|max:2000',
    ]),
    $write('PATCH', '/admin/inventory/materials/{material}', 'update', 'admin.inventory.materials.update', [
        'name' => 'nullable|string|min:2|max:160',
        'code' => 'nullable|string|max:40',
        'kind' => $KIND,
        'unit' => $UNIT,
        'status' => 'nullable|string|in:ACTIVE,ARCHIVED',
        'reorderPoint' => 'nullable|number|min:0',
        'unitCost' => 'nullable|number|min:0',
        'supplier' => 'nullable|string|max:16',
        'warehouse' => 'nullable|string|max:16',
        'notes' => 'nullable|string|max:2000',
    ]),
    $write('DELETE', '/admin/inventory/materials/{material}', 'destroy', 'admin.inventory.materials.delete'),

    /* A count correction. `reason` is REQUIRED — an adjustment nobody can
       explain afterwards is what makes a whole ledger untrustworthy. */
    $write('POST', '/admin/inventory/materials/{material}/adjust', 'adjust', 'admin.inventory.materials.adjust', [
        'onHand' => 'required|number|min:0',
        'reason' => 'required|string|min:3|max:190',
    ]),
    $write('POST', '/admin/inventory/materials/{material}/write-off', 'writeOff', 'admin.inventory.materials.write_off', [
        'qty' => 'required|number|min:0',
        'type' => 'nullable|string|in:WASTAGE,RETURN_OUT',
        'reason' => 'required|string|min:3|max:190',
    ]),

    // ------------------------------------------------------------ suppliers
    $read('/admin/inventory/suppliers', 'suppliers', 'admin.inventory.suppliers.index'),

    $write('POST', '/admin/inventory/suppliers', 'storeSupplier', 'admin.inventory.suppliers.create', [
        'name' => 'required|string|min:2|max:160',
        'contactName' => 'nullable|string|max:120',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'city' => 'nullable|string|max:80',
        'country' => 'nullable|string|max:80',
        'leadTimeDays' => 'nullable|int|min:0|max:365',
        'notes' => 'nullable|string|max:2000',
    ]),
    $write('PATCH', '/admin/inventory/suppliers/{supplier}', 'updateSupplier', 'admin.inventory.suppliers.update', [
        'name' => 'nullable|string|min:2|max:160',
        'contactName' => 'nullable|string|max:120',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'city' => 'nullable|string|max:80',
        'country' => 'nullable|string|max:80',
        'leadTimeDays' => 'nullable|int|min:0|max:365',
        'status' => 'nullable|string|in:ACTIVE,ARCHIVED',
        'notes' => 'nullable|string|max:2000',
    ]),
    $write('DELETE', '/admin/inventory/suppliers/{supplier}', 'destroySupplier', 'admin.inventory.suppliers.delete'),

    // ------------------------------------------------------------ purchases
    $read('/admin/inventory/purchases', 'purchases', 'admin.inventory.purchases.index'),
    $read('/admin/inventory/purchases/{purchase}', 'showPurchase', 'admin.inventory.purchases.show'),

    $write('POST', '/admin/inventory/purchases', 'storePurchase', 'admin.inventory.purchases.create', [
        'supplier' => 'required|string|max:16',
        'expectedOn' => 'nullable|string|regex:/^\d{4}-\d{2}-\d{2}$/',
        'notes' => 'nullable|string|max:2000',
    ]),
    /* The whole line set at once: a purchase order is edited as a document, and
       sending it whole is what makes removing a line possible without a second
       endpoint. */
    $write('PUT', '/admin/inventory/purchases/{purchase}/lines', 'setPurchaseLines', 'admin.inventory.purchases.lines', [
        'lines' => 'required|array|max:200',
    ]),
    $write('POST', '/admin/inventory/purchases/{purchase}/transition', 'transitionPurchase', 'admin.inventory.purchases.transition', [
        'to' => 'required|string|in:order,cancel',
    ]),
    $write('POST', '/admin/inventory/purchases/{purchase}/receive', 'receivePurchase', 'admin.inventory.purchases.receive', [
        'lines' => 'required|array|min:1|max:200',
    ]),
    $write('DELETE', '/admin/inventory/purchases/{purchase}', 'destroyPurchase', 'admin.inventory.purchases.delete'),

    // -------------------------------------------------------------- recipes
    $read('/admin/inventory/recipes/{item}', 'recipe', 'admin.inventory.recipes.show'),
    $write('PUT', '/admin/inventory/recipes/{item}', 'setRecipe', 'admin.inventory.recipes.update', [
        'lines' => 'required|array|max:100',
    ]),

    // ----------------------------------------------------------------- runs
    $read('/admin/inventory/runs', 'runs', 'admin.inventory.runs.index'),
    $read('/admin/inventory/runs/{run}', 'showRun', 'admin.inventory.runs.show'),

    $write('POST', '/admin/inventory/runs', 'storeRun', 'admin.inventory.runs.create', [
        'item' => 'required|string|max:40',
        'qty' => 'required|int|min:1|max:100000',
        'warehouse' => 'nullable|string|max:16',
        'notes' => 'nullable|string|max:2000',
    ]),
    $write('POST', '/admin/inventory/runs/{run}/transition', 'transitionRun', 'admin.inventory.runs.transition', [
        'to' => 'required|string|in:start,complete,cancel',
        /* Only read on `complete`: what was ACTUALLY made, which is not always
           what was planned. */
        'produced' => 'nullable|int|min:0|max:100000',
    ]),
    $write('DELETE', '/admin/inventory/runs/{run}', 'destroyRun', 'admin.inventory.runs.delete'),
];
