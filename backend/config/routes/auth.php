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
];
