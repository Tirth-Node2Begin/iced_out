<?php

declare(strict_types=1);

use Iced\Controller\Customer\OrderController;
use Iced\Controller\Customer\WalletController;
use Iced\Controller\Customer\ProfileController;
use Iced\Kernel\Route;

/** Spec §8.3 profile (9) and §8.4 addresses (5). Customer audience throughout. */

/**
 * Customer routes whose use must leave a trace in `audit_logs`.
 *
 * `Route::fromArray()` defaults `audit` to true for STAFF mutations only, which
 * meant the console was fully accountable and the shop was not: a password
 * change, an email change and a session revocation — the exact three actions an
 * account takeover performs — produced no audit row anywhere. When a customer
 * reported losing their account there was nothing to read.
 *
 * Deliberately a short list. Auditing every customer write would turn
 * `audit_logs` into a second orders table and bury the rows that matter; these
 * are the ones that change WHO CAN GET IN.
 */
$AUDITED = ['me.update', 'me.password', 'me.sessions.revoke', 'me.sessions.revoke_others'];

$customer = static fn (string $verb, string $path, string $method, string $name, array $rules = []): array => [
    'method' => $verb,
    'path' => $path,
    'handler' => [ProfileController::class, $method],
    'audience' => Route::AUDIENCE_CUSTOMER,
    'name' => $name,
    'rules' => $rules,
    'audit' => in_array($name, $AUDITED, true),
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
    /*
     * `currentPassword` is optional HERE and required in the controller, and
     * only when `email` is being changed — a rule language with no conditionals
     * cannot say "required if", and marking it required outright would break
     * every name and mobile edit.
     *
     * Why it is demanded at all: this endpoint moved the address a password
     * reset is sent to, with no re-authentication, no verification of the new
     * address, and no notice to the old one. A session someone else briefly held
     * — a shared laptop, a stolen cookie — could therefore be turned into
     * permanent ownership of the account: change the email, then use "forgot
     * password" against the new one. Knowing the password is what separates the
     * owner from a borrowed session.
     */
    $customer('PATCH', '/me', 'update', 'me.update', [
        'name' => 'string|min:2|max:120',
        'email' => 'email|max:190',
        'mobile' => 'string|max:20',
        'currentPassword' => 'string|max:200',
    ]),
    /* Its own bucket: an upload decodes and re-encodes an image, and this
       route had no rate_limit key at all — it fell through to `default`, 240 a
       minute. See config/app.php → rate_limits.uploads. */
    $customer('PUT', '/me/photo', 'uploadPhoto', 'me.photo.upload') + ['rate_limit' => 'uploads'],
    $customer('DELETE', '/me/photo', 'deletePhoto', 'me.photo.delete'),
    /* `password_change`, because this route had NO bucket — not `default`, not
       anything. It takes the current password and reports whether it was right,
       so a stolen session cookie could be used to guess the password behind it
       at whatever rate the host would answer. See config/app.php. */
    $customer('POST', '/me/password', 'changePassword', 'me.password', [
        'current' => 'required|string|min:1|max:200',
        'next' => 'required|string|min:8|max:200',
    ]) + ['rate_limit' => 'password_change'],
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

    /* The wallet. Store credit stopped being a coupon and became a balance —
       see WalletService — so it reads and tops up here rather than through the
       cart's redemption path. Spending it is NOT an endpoint: credit only ever
       leaves a wallet inside the place-order transaction, weighed against an
       order being created in the same breath. */
    [
        'method' => 'GET', 'path' => '/me/wallet',
        'handler' => [WalletController::class, 'show'],
        'audience' => Route::AUDIENCE_CUSTOMER, 'name' => 'me.wallet.show',
    ],
    [
        'method' => 'POST', 'path' => '/me/wallet/redeem',
        'handler' => [WalletController::class, 'redeem'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        // A double-tap on a slow connection must not try to add the code twice.
        'idempotent' => true,
        'rate_limit' => 'payments',
        // Money entering a wallet. The ledger says what moved; this says who
        // asked, from which address, under which request id.
        'audit' => true,
        'name' => 'me.wallet.redeem',
        'rules' => ['code' => 'required|string|min:3|max:40'],
    ],

    $customer('GET', '/me/addresses', 'addresses', 'me.addresses.index'),
    $customer('POST', '/me/addresses', 'createAddress', 'me.addresses.create', $requiredAddressRules),
    $customer('PATCH', '/me/addresses/{id}', 'updateAddress', 'me.addresses.update', $addressRules),
    $customer('DELETE', '/me/addresses/{id}', 'deleteAddress', 'me.addresses.delete'),
    $customer('POST', '/me/addresses/{id}/default', 'makeAddressDefault', 'me.addresses.make_default'),
];
