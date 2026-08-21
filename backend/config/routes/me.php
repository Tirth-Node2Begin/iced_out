<?php

declare(strict_types=1);

use Iced\Controller\Customer\OrderController;
use Iced\Controller\Customer\ProfileController;
use Iced\Kernel\Route;

/** Spec §8.3 profile (9) and §8.4 addresses (5). Customer audience throughout. */

$customer = static fn (string $verb, string $path, string $method, string $name, array $rules = []): array => [
    'method' => $verb,
    'path' => $path,
    'handler' => [ProfileController::class, $method],
    'audience' => Route::AUDIENCE_CUSTOMER,
    'name' => $name,
    'rules' => $rules,
];

// Server-side mirror of checkout-validation.ts, so the browser and the API
// refuse exactly the same address.
$addressRules = [
    'label' => 'string|max:40',
    'name' => 'string|max:120',
    'street' => 'string|min:6|max:255',
    'city' => 'string|max:80',
    'state' => 'string|max:80',
    'pincode' => 'pincode',
    'phone' => 'string|max:20',
    'makeDefault' => 'bool',
];

$requiredAddressRules = $addressRules;
$requiredAddressRules['name'] = 'required|string|min:2|max:120';
$requiredAddressRules['street'] = 'required|string|min:6|max:255';
$requiredAddressRules['city'] = 'required|string|max:80';
$requiredAddressRules['state'] = 'required|string|max:80';
$requiredAddressRules['pincode'] = 'required|pincode';

return [
    $customer('GET', '/me', 'show', 'me.show'),
    $customer('PATCH', '/me', 'update', 'me.update', [
        'name' => 'string|min:2|max:120',
        'email' => 'email|max:190',
        'mobile' => 'string|max:20',
    ]),
    $customer('PUT', '/me/photo', 'uploadPhoto', 'me.photo.upload'),
    $customer('DELETE', '/me/photo', 'deletePhoto', 'me.photo.delete'),
    $customer('POST', '/me/password', 'changePassword', 'me.password', [
        'current' => 'required|string|min:1|max:200',
        'next' => 'required|string|min:8|max:200',
    ]),
    $customer('GET', '/me/sessions', 'sessions', 'me.sessions.index'),
    $customer('DELETE', '/me/sessions/{id}', 'revokeSession', 'me.sessions.revoke'),
    $customer('POST', '/me/sessions/revoke-others', 'revokeOtherSessions', 'me.sessions.revoke_others'),

    // Spec §8.10 orders and §8.13 vouchers — the shopper's own records, always
    // scoped to their account.
    [
        'method' => 'GET', 'path' => '/me/orders',
        'handler' => [OrderController::class, 'index'],
        'audience' => Route::AUDIENCE_CUSTOMER, 'name' => 'me.orders.index',
    ],
    [
        'method' => 'GET', 'path' => '/me/orders/{id}',
        'handler' => [OrderController::class, 'show'],
        'audience' => Route::AUDIENCE_CUSTOMER, 'name' => 'me.orders.show',
    ],
    [
        'method' => 'GET', 'path' => '/me/vouchers',
        'handler' => [OrderController::class, 'vouchers'],
        'audience' => Route::AUDIENCE_CUSTOMER, 'name' => 'me.vouchers.index',
    ],

    $customer('GET', '/me/addresses', 'addresses', 'me.addresses.index'),
    $customer('POST', '/me/addresses', 'createAddress', 'me.addresses.create', $requiredAddressRules),
    $customer('PATCH', '/me/addresses/{id}', 'updateAddress', 'me.addresses.update', $addressRules),
    $customer('DELETE', '/me/addresses/{id}', 'deleteAddress', 'me.addresses.delete'),
    $customer('POST', '/me/addresses/{id}/default', 'makeAddressDefault', 'me.addresses.make_default'),
];
