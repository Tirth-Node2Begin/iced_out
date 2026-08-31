<?php

declare(strict_types=1);

use Iced\Controller\Console\AuthController;
use Iced\Kernel\Route;

/**
 * Spec §8.17 — staff auth. Served by the files under api/admin/auth/.
 *
 * PATH PREFIX: these mount at /api/v1/admin/**, mirroring the api/admin/ folder
 * and the console's own /admin/* routes. backend_setup.md §8 writes them as
 * /console/**; the prefix lives only in the `path` values below, so switching
 * back is a find-and-replace in config/routes/admin_*.php and nothing else.
 */
return [
    [
        'method' => 'POST',
        'path' => '/admin/auth/login',
        'handler' => [AuthController::class, 'login'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'auth',
        'name' => 'admin.auth.login',
        'rules' => [
            'email' => 'required|email|max:190',
            'password' => 'required|string|min:1|max:200',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/auth/logout',
        'handler' => [AuthController::class, 'logout'],
        'audience' => Route::AUDIENCE_STAFF,
        'name' => 'admin.auth.logout',
        // Sign-out is not an auditable console mutation; the session row is the record.
        'audit' => false,
    ],
    [
        'method' => 'GET',
        'path' => '/admin/auth/session',
        'handler' => [AuthController::class, 'session'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'console_read',
        'name' => 'admin.auth.session',
    ],
    [
        'method' => 'POST',
        'path' => '/admin/auth/touch',
        'handler' => [AuthController::class, 'touch'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'console_read',
        'name' => 'admin.auth.touch',
        'audit' => false,
    ],
];
