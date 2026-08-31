<?php

declare(strict_types=1);

use Iced\Controller\Console\CustomerController;
use Iced\Controller\Console\ReviewController;
use Iced\Controller\Console\SupportController;
use Iced\Kernel\Route;

/** Spec §8.26 customers (6), §8.27 reviews (4), §8.28 support (4). */
return [
    /* ------------------------------------------------------------ customers */
    [
        'method' => 'GET', 'path' => '/admin/customers',
        'handler' => [CustomerController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'customers.view',
        'rate_limit' => 'console_read', 'name' => 'admin.customers.index',
    ],
    [
        'method' => 'GET', 'path' => '/admin/customers/{id}',
        'handler' => [CustomerController::class, 'show'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'customers.view',
        'rate_limit' => 'console_read', 'name' => 'admin.customers.show',
    ],
    [
        'method' => 'GET', 'path' => '/admin/customers/{id}/orders',
        'handler' => [CustomerController::class, 'orders'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'customers.view',
        'rate_limit' => 'console_read', 'name' => 'admin.customers.orders',
    ],
    [
        'method' => 'GET', 'path' => '/admin/customers/{id}/activity',
        'handler' => [CustomerController::class, 'activity'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'customers.view',
        'rate_limit' => 'console_read', 'name' => 'admin.customers.activity',
    ],
    [
        'method' => 'POST', 'path' => '/admin/customers',
        'handler' => [CustomerController::class, 'create'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'customers.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.customers.create',
        'rules' => [
            'name' => 'required|string|min:2|max:120',
            'email' => 'required|email|max:190',
            'phone' => 'string|max:20',
        ],
    ],
    [
        'method' => 'PATCH', 'path' => '/admin/customers/{id}',
        'handler' => [CustomerController::class, 'update'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'customers.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.customers.update',
        'rules' => [
            'name' => 'string|min:2|max:120',
            'phone' => 'string|max:20',
            'state' => 'string|in:Active,Blocked',
        ],
    ],

    /* -------------------------------------------------------------- reviews */
    [
        'method' => 'GET', 'path' => '/admin/reviews',
        'handler' => [ReviewController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reviews.moderate',
        'rate_limit' => 'console_read', 'name' => 'admin.reviews.index',
    ],
    [
        'method' => 'POST', 'path' => '/admin/reviews',
        'handler' => [ReviewController::class, 'create'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reviews.moderate',
        'rate_limit' => 'console_write', 'name' => 'admin.reviews.create',
        'rules' => [
            'product' => 'required|string|max:160',
            'rating' => 'required|int|min:1|max:5',
            'customer' => 'required|string|max:120',
            'headline' => 'required|string|min:3|max:160',
            'body' => 'string|max:4000',
        ],
    ],
    [
        'method' => 'PATCH', 'path' => '/admin/reviews/{id}',
        'handler' => [ReviewController::class, 'update'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reviews.moderate',
        'rate_limit' => 'console_write', 'name' => 'admin.reviews.update',
        /* No `product` and no `status`. What a review is about is its author's
           one decision, and its state is moved by the two verbs below — an edit
           that could do either would be a way to publish without deciding. */
        'rules' => [
            'rating' => 'int|min:1|max:5',
            'customer' => 'string|max:120',
            'headline' => 'string|min:3|max:160',
            'body' => 'nullable|string|max:4000',
            'fit' => 'nullable|string|max:40',
        ],
    ],
    /* Hide and show, not approve and reject. A review is live when it is
       written, so the desk's job is taking one down and putting it back —
       both of which write a moderation history row. See migration 0022. */
    [
        'method' => 'POST', 'path' => '/admin/reviews/{id}/hide',
        'handler' => [ReviewController::class, 'hide'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reviews.moderate',
        'rate_limit' => 'console_write', 'name' => 'admin.reviews.hide',
    ],
    [
        'method' => 'POST', 'path' => '/admin/reviews/{id}/publish',
        'handler' => [ReviewController::class, 'publish'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reviews.moderate',
        'rate_limit' => 'console_write', 'name' => 'admin.reviews.publish',
    ],
    [
        'method' => 'DELETE', 'path' => '/admin/reviews/{id}',
        'handler' => [ReviewController::class, 'destroy'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reviews.moderate',
        'rate_limit' => 'console_write', 'name' => 'admin.reviews.delete',
    ],

    /* -------------------------------------------------------------- support */
    [
        'method' => 'GET', 'path' => '/admin/support/queries',
        'handler' => [SupportController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'support.tickets.manage',
        'rate_limit' => 'console_read', 'name' => 'admin.support.index',
    ],
    [
        'method' => 'GET', 'path' => '/admin/support/queries/{reference}',
        'handler' => [SupportController::class, 'show'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'support.tickets.manage',
        'rate_limit' => 'console_read', 'name' => 'admin.support.show',
    ],
    [
        'method' => 'POST', 'path' => '/admin/support/queries/{reference}/resolve',
        'handler' => [SupportController::class, 'resolve'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'support.tickets.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.support.resolve',
        // Answering IS resolving, so an empty reply is not a resolution.
        'rules' => ['reply' => 'required|string|min:1|max:4000'],
    ],
    [
        'method' => 'POST', 'path' => '/admin/support/queries/{reference}/reopen',
        'handler' => [SupportController::class, 'reopen'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'support.tickets.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.support.reopen',
    ],
];
