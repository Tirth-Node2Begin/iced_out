<?php

declare(strict_types=1);

use Iced\Controller\Customer\CheckoutController;
use Iced\Kernel\Route;

/**
 * Spec §8.9 — checkout.
 *
 * The rules here check the SHAPE of the request only. Everything that decides
 * whether an order may exist — prices, stock, the coupon, the address — is
 * re-derived server-side in PlaceOrderService, because none of it can be
 * trusted from a page that may have been open for an hour.
 */
return [
    [
        'method' => 'POST',
        'path' => '/checkout/orders',
        'handler' => [CheckoutController::class, 'place'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        // A double-tap on a slow connection must not buy the bag twice.
        'idempotent' => true,
        'name' => 'checkout.orders.place',
    ],
    [
        'method' => 'GET',
        'path' => '/checkout/delivery-options',
        'handler' => [CheckoutController::class, 'deliveryOptions'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'checkout.delivery_options',
    ],
    [
        'method' => 'GET',
        'path' => '/me/checkout/draft',
        'handler' => [CheckoutController::class, 'draft'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'me.checkout.draft',
    ],
    [
        'method' => 'PUT',
        'path' => '/me/checkout/draft',
        'handler' => [CheckoutController::class, 'saveDraft'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'me.checkout.draft_save',
        'rules' => [
            'name' => 'string|max:120',
            'email' => 'string|max:190',
            'mobile' => 'string|max:20',
            'address' => 'string|max:255',
            'city' => 'string|max:80',
            'state' => 'string|max:80',
            'postalCode' => 'string|max:10',
            'deliveryMethod' => 'string|max:16',
            'paymentMethod' => 'string|max:16',
        ],
    ],
];
