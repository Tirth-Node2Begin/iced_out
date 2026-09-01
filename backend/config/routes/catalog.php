<?php

declare(strict_types=1);

use Iced\Controller\Customer\CatalogController;
use Iced\Kernel\Route;

/**
 * The public catalogue — the storefront's read side of the same `products` table
 * the console writes to.
 *
 * Public audience: browsing a shop needs no account, and requiring one would
 * mean a signed-out visitor could not see anything for sale. The `catalog` rate
 * limit class is the one the storefront config endpoint already uses.
 */
return [
    [
        'method' => 'GET',
        'path' => '/catalog/products',
        'handler' => [CatalogController::class, 'products'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'catalog.products.index',
    ],
    /*
     * The home page's trending rail. Its own route rather than a `?sort=` on
     * the index, because the ordering is derived from the order book and the
     * two reads have genuinely different costs — a listing page should not pay
     * for a join over `order_items` it does not use.
     */
    [
        'method' => 'GET',
        'path' => '/catalog/trending',
        'handler' => [CatalogController::class, 'trending'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'catalog.products.trending',
    ],
    [
        'method' => 'GET',
        'path' => '/catalog/products/{slug}',
        'handler' => [CatalogController::class, 'show'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'catalog.products.show',
    ],
    [
        'method' => 'GET',
        'path' => '/catalog/collections',
        'handler' => [CatalogController::class, 'collections'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'catalog.collections.index',
    ],
];
