<?php

declare(strict_types=1);

use Iced\Controller\Customer\CheckoutController;
use Iced\Controller\Customer\PaymentController;
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
    /**
     * The two gateway steps that need the SECRET, and so cannot be done in the
     * browser. Both sit under /checkout because they are part of the act of
     * paying, not a payments area of their own — the console's own payments
     * endpoints are in admin_payments.php.
     */
    [
        'method' => 'POST',
        'path' => '/checkout/payments/razorpay/order',
        'handler' => [PaymentController::class, 'createOrder'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'rate_limit' => 'payments',
        'name' => 'checkout.payments.razorpay.order',
        'rules' => [
            // Rupees, like every other figure crossing this boundary. The cap
            // is a sanity bound, not a business rule: the order this pays for
            // is re-priced from the catalogue when it is placed.
            'amount' => 'required|int|min:1|max:10000000',
            'receipt' => 'string|max:40',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/checkout/payments/razorpay/verify',
        'handler' => [PaymentController::class, 'verify'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'rate_limit' => 'payments',
        'name' => 'checkout.payments.razorpay.verify',
        'rules' => [
            'orderId' => 'required|string|max:64',
            'paymentId' => 'required|string|max:64',
            'signature' => 'required|string|max:128',
        ],
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
