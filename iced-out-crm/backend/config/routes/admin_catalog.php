<?php

declare(strict_types=1);

use Iced\Controller\Console\CatalogController;
use Iced\Kernel\Route;

/** Spec §8.21 — console catalog (12). Perms catalog.view / catalog.edit / catalog.publish. */

$read = static fn (string $path, string $method, string $name): array => [
    'method' => 'GET',
    'path' => $path,
    'handler' => [CatalogController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'catalog.view',
    'rate_limit' => 'console_read',
    'name' => $name,
];

$write = static fn (string $verb, string $path, string $method, string $name, string $permission = 'catalog.edit'): array => [
    'method' => $verb,
    'path' => $path,
    'handler' => [CatalogController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => $permission,
    'rate_limit' => 'console_write',
    'name' => $name,
];

return [
    $read('/admin/catalog/products', 'products', 'admin.catalog.products.index'),
    $read('/admin/catalog/listing-room', 'listingRoom', 'admin.catalog.listing_room'),
    $read('/admin/catalog/variants', 'variants', 'admin.catalog.variants.index'),
    $read('/admin/catalog/categories', 'categories', 'admin.catalog.categories.index'),
    $read('/admin/catalog/collections', 'collections', 'admin.catalog.collections.index'),
    $read('/admin/catalog/products/{slug}', 'showProduct', 'admin.catalog.products.show'),

    $write('POST', '/admin/catalog/products', 'createProduct', 'admin.catalog.products.create') + [
        'rules' => [
            'name' => 'required|string|min:2|max:160',
            'item' => 'required|string|max:40',
            'size' => 'required|string|max:8',
            'price' => 'required|int|min:0|max:10000000',
            'category' => 'string|max:80',
            'collection' => 'string|max:80',
            'status' => 'string|max:16',
            'tax' => 'string|max:120',
            'description' => 'string|max:2000',
            // The id (or URL) returned by POST /admin/media. Empty clears it.
            'image' => 'nullable|string|max:190',
        ],
    ],
    $write('PATCH', '/admin/catalog/products/{slug}', 'updateProduct', 'admin.catalog.products.update') + [
        'rules' => [
            'name' => 'string|min:2|max:160',
            'item' => 'string|max:40',
            'size' => 'string|max:8',
            'price' => 'int|min:0|max:10000000',
            'category' => 'string|max:80',
            'collection' => 'string|max:80',
            'status' => 'string|max:16',
            'tax' => 'string|max:120',
            'description' => 'string|max:2000',
            // The id (or URL) returned by POST /admin/media. Empty clears it.
            'image' => 'nullable|string|max:190',
        ],
    ],
    $write('POST', '/admin/catalog/products/{slug}/publish', 'publishProduct', 'admin.catalog.products.publish', 'catalog.publish'),
    $write('DELETE', '/admin/catalog/products/{slug}', 'deleteProduct', 'admin.catalog.products.delete'),

    $write('POST', '/admin/catalog/variants', 'createVariant', 'admin.catalog.variants.create') + [
        'rules' => [
            'product' => 'required|string|max:80',
            'size' => 'required|string|max:8',
            'colour' => 'required|string|max:60',
            'stock' => 'int|min:0|max:100000',
        ],
    ],
    $write('PATCH', '/admin/catalog/variants/{sku}', 'updateVariant', 'admin.catalog.variants.update') + [
        'rules' => ['status' => 'string|max:16'],
    ],
    $write('DELETE', '/admin/catalog/variants/{sku}', 'archiveVariant', 'admin.catalog.variants.archive'),

    $write('POST', '/admin/catalog/categories', 'createCategory', 'admin.catalog.categories.create') + [
        'rules' => ['name' => 'required|string|min:2|max:80'],
    ],
    $write('PATCH', '/admin/catalog/categories/{id}', 'updateCategory', 'admin.catalog.categories.update') + [
        'rules' => ['name' => 'required|string|min:2|max:80'],
    ],
    $write('DELETE', '/admin/catalog/categories/{id}', 'deleteCategory', 'admin.catalog.categories.delete'),

    $write('POST', '/admin/catalog/collections', 'createCollection', 'admin.catalog.collections.create') + [
        'rules' => [
            'name' => 'required|string|min:2|max:120',
            'status' => 'string|max:16',
        ],
    ],
    $write('PATCH', '/admin/catalog/collections/{id}', 'updateCollection', 'admin.catalog.collections.update') + [
        'rules' => [
            'name' => 'string|min:2|max:120',
            'status' => 'string|max:16',
        ],
    ],
    $write('DELETE', '/admin/catalog/collections/{id}', 'deleteCollection', 'admin.catalog.collections.delete'),
];
