<?php

declare(strict_types=1);

use Iced\Controller\Customer\AuthController;
use Iced\Kernel\Route;

/**
 * Spec §8.2 — customer auth. Served by the files under api/auth/.
 *
 * Password minimums follow the UI: customer 6 characters, staff 12.
 */
return [
    [
        'method' => 'POST',
        'path' => '/auth/register',
        'handler' => [AuthController::class, 'register'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'auth',
        'name' => 'auth.register',
        'rules' => [
            'name' => 'required|string|min:2|max:120',
            'email' => 'required|email|max:190',
            'password' => 'required|string|min:6|max:200',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/auth/login',
        'handler' => [AuthController::class, 'login'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'auth',
        'name' => 'auth.login',
        'rules' => [
            'email' => 'required|email|max:190',
            'password' => 'required|string|min:1|max:200',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/auth/logout',
        'handler' => [AuthController::class, 'logout'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'auth.logout',
    ],
    [
        'method' => 'GET',
        'path' => '/auth/session',
        'handler' => [AuthController::class, 'session'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'auth.session',
    ],

    /*
     * Forgotten password, by emailed one-time code (#10–11).
     *
     * Three routes for two spec entries: `verify` is the extra one, and it
     * exists so the UI can move a shopper to the "choose a new password" step
     * on a code that is known good, rather than asking for a password and
     * rejecting the whole thing afterwards. It checks without spending.
     *
     * `forgot` is the one that could be used to post mail at an address
     * somebody does not own, so it keeps the tightest bucket in the table
     * (5/hour/IP) on top of the service's own per-account resend cooldown.
     */
    [
        'method' => 'POST',
        'path' => '/auth/password/forgot',
        'handler' => [AuthController::class, 'forgotPassword'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'password_forgot',
        'name' => 'auth.password.forgot',
        'rules' => [
            'email' => 'required|email|max:190',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/auth/password/verify',
        'handler' => [AuthController::class, 'verifyPasswordCode'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'password_otp',
        'name' => 'auth.password.verify',
        'rules' => [
            'email' => 'required|email|max:190',
            'code' => 'required|string|min:6|max:6',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/auth/password/reset',
        'handler' => [AuthController::class, 'resetPassword'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'password_otp',
        'name' => 'auth.password.reset',
        'rules' => [
            'email' => 'required|email|max:190',
            'code' => 'required|string|min:6|max:6',
            // Six, matching /auth/register — a reset that demanded more than
            // registration does would lock people out of their own accounts.
            'password' => 'required|string|min:6|max:200',
        ],
    ],
];
