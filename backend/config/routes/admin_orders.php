<?php

declare(strict_types=1);

use Iced\Controller\Console\OrderController;
use Iced\Kernel\Route;

/** Spec §8.19 — console orders (6). */
return [
    [
        'method' => 'GET',
        'path' => '/admin/orders',
        'handler' => [OrderController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'orders.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.orders.index',
    ],
    [
        'method' => 'GET',
        'path' => '/admin/orders/{number}',
        'handler' => [OrderController::class, 'show'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'orders.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.orders.show',
    ],
    [
        'method' => 'GET',
        'path' => '/admin/orders/{number}/timeline',
        'handler' => [OrderController::class, 'timeline'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'orders.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.orders.timeline',
    ],
    [
        'method' => 'POST',
        'path' => '/admin/orders/{number}/confirm',
        'handler' => [OrderController::class, 'confirm'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'orders.manage',
        'rate_limit' => 'console_write',
        'name' => 'admin.orders.confirm',
    ],
    [
        'method' => 'POST',
        'path' => '/admin/orders/{number}/cancel',
        'handler' => [OrderController::class, 'cancel'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'orders.manage',
        'rate_limit' => 'console_write',
        'name' => 'admin.orders.cancel',
        'rules' => ['by' => 'required|string|in:Store,Customer'],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/orders/{number}/dispatch',
        'handler' => [OrderController::class, 'dispatch'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'shipping.manage',
        'rate_limit' => 'console_write',
        'name' => 'admin.orders.dispatch',
        // The courier list is a settings vocabulary, checked in the service.
        'rules' => [
            'provider' => 'required|string|max:40',
            'destination' => 'string|max:120',
        ],
    ],
];
