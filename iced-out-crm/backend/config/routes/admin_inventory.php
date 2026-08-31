<?php

declare(strict_types=1);

use Iced\Controller\Console\InventoryController;
use Iced\Kernel\Route;

/** Spec §8.22 — console inventory (10). Perms inventory.view / adjust / transfer. */

$read = static fn (string $path, string $method, string $name): array => [
    'method' => 'GET',
    'path' => $path,
    'handler' => [InventoryController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'inventory.view',
    'rate_limit' => 'console_read',
    'name' => $name,
];

$write = static fn (string $verb, string $path, string $method, string $name, string $permission = 'inventory.adjust'): array => [
    'method' => $verb,
    'path' => $path,
    'handler' => [InventoryController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => $permission,
    'rate_limit' => 'console_write',
    'name' => $name,
];

return [
    $read('/admin/inventory/items', 'items', 'admin.inventory.items.index'),
    $read('/admin/inventory/movements', 'movements', 'admin.inventory.movements'),
    $read('/admin/inventory/transfers', 'transfers', 'admin.inventory.transfers.index'),
    $read('/admin/inventory/warehouses', 'warehouses', 'admin.inventory.warehouses.index'),
    $read('/admin/inventory/at-risk', 'atRisk', 'admin.inventory.at_risk'),

    $write('POST', '/admin/inventory/items', 'createItem', 'admin.inventory.items.create') + [
        'rules' => [
            'itemName' => 'required|string|min:2|max:160',
            'category' => 'required|string|max:16',
            // Men, Women or Unisex — who the garment is cut for. It decides which
            // gender page a product listed from this item appears on.
            'audience' => 'string|max:16',
            'itemType' => 'required|string|max:80',
            'sizes' => 'required|string|max:120',
            'warehouse' => 'required|string|max:16',
            'totalUnits' => 'int|min:0|max:1000000',
            'reservedUnits' => 'int|min:0|max:1000000',
            // Whole rupees. Asked here because the item is where a garment is
            // described, and a listing made from it inherits what it costs.
            'price' => 'int|min:0|max:100000000',
            // The id (or URL) returned by POST /admin/media. Empty clears it.
            'image' => 'nullable|string|max:190',
            // The secondary shots, as one comma-joined list of media URLs, in
            // display order. Long enough for a dozen of them.
            'images' => 'nullable|string|max:2400',
            // Tick to list this straight into the shop as a Published product.
            'publish' => 'nullable|string|max:8',
        ],
    ],
    $write('PATCH', '/admin/inventory/items/{id}', 'updateItem', 'admin.inventory.items.update') + [
        'rules' => [
            'itemName' => 'string|min:2|max:160',
            'audience' => 'string|max:16',
            // Top or Bottom. It was missing here while the console's form has
            // always collected it, so an operator correcting a mis-filed item
            // watched the change save and do nothing — `validated()` returns
            // only what the rules name, so the field never reached the handler.
            'category' => 'string|max:16',
            'itemType' => 'string|max:80',
            'sizes' => 'string|max:120',
            'warehouse' => 'string|max:16',
            'totalUnits' => 'int|min:0|max:1000000',
            'reservedUnits' => 'int|min:0|max:1000000',
            'price' => 'int|min:0|max:100000000',
            // The id (or URL) returned by POST /admin/media. Empty clears it.
            'image' => 'nullable|string|max:190',
            'images' => 'nullable|string|max:2400',
        ],
    ],
    $write('DELETE', '/admin/inventory/items/{id}', 'deleteItem', 'admin.inventory.items.delete'),
    $write('POST', '/admin/inventory/items/{id}/reserve', 'reserve', 'admin.inventory.items.reserve') + [
        'rules' => ['reservedUnits' => 'required|int|min:0|max:1000000'],
    ],

    $write('POST', '/admin/inventory/transfers', 'createTransfer', 'admin.inventory.transfers.create', 'inventory.transfer') + [
        'rules' => [
            'from' => 'required|string|max:16',
            'to' => 'required|string|max:16',
            'units' => 'required|int|min:1|max:1000000',
            'dispatched' => 'required|string|max:40',
        ],
    ],
    $write('POST', '/admin/inventory/transfers/{id}/transition', 'transitionTransfer', 'admin.inventory.transfers.transition', 'inventory.transfer') + [
        'rules' => ['status' => 'required|string|in:In transit,Received,Cancelled'],
    ],

    $write('POST', '/admin/inventory/warehouses', 'createWarehouse', 'admin.inventory.warehouses.create') + [
        'rules' => [
            'id' => 'required|string|max:16',
            'name' => 'required|string|min:2|max:120',
            'capacity' => 'int|min:0|max:100',
            'cutoff' => 'string|max:40',
            'status' => 'string|max:16',
        ],
    ],
    $write('PATCH', '/admin/inventory/warehouses/{id}', 'updateWarehouse', 'admin.inventory.warehouses.update') + [
        'rules' => [
            'name' => 'string|min:2|max:120',
            'capacity' => 'int|min:0|max:100',
            'cutoff' => 'string|max:40',
            'status' => 'string|max:16',
        ],
    ],
];
