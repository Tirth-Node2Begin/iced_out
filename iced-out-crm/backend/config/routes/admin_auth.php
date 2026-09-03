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

    /*
     * #87–88 — console account recovery by emailed one-time code.
     *
     * PUBLIC audience, necessarily: somebody who cannot sign in cannot present
     * a staff cookie. What keeps this from being a way into the console is that
     * the code goes to the mailbox on the staff record and nowhere else, and
     * that `forgot` answers 202 whether or not that record exists — so the
     * endpoint cannot be used to find out which addresses are staff.
     *
     * `verify` is the extra route (see the storefront's copy of this comment):
     * it checks a code without spending it so the form can move to the password
     * step on something known good.
     */
    [
        'method' => 'POST',
        'path' => '/admin/auth/password/forgot',
        'handler' => [AuthController::class, 'forgotPassword'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'password_forgot',
        'name' => 'admin.auth.password.forgot',
        'rules' => [
            'email' => 'required|email|max:190',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/auth/password/verify',
        'handler' => [AuthController::class, 'verifyPasswordCode'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'password_otp',
        'name' => 'admin.auth.password.verify',
        'rules' => [
            'email' => 'required|email|max:190',
            'code' => 'required|string|min:6|max:6',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/auth/password/reset',
        'handler' => [AuthController::class, 'resetPassword'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'password_otp',
        'name' => 'admin.auth.password.reset',
        'rules' => [
            'email' => 'required|email|max:190',
            'code' => 'required|string|min:6|max:6',
            // Twelve for staff, six for shoppers (§8.2 #11). A console account
            // opens every order and every customer record in the shop.
            'password' => 'required|string|min:12|max:200',
        ],
    ],
];
