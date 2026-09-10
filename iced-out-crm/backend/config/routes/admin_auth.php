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
    /**
     * Two-factor authentication for console accounts (opt-in, off by default).
     *
     * `verify` is PUBLIC audience, necessarily: it completes a sign-in, so there
     * is no session yet to present. What authorises it is the challenge ticket
     * `login` issued moments earlier, which is single-use, five minutes long, and
     * grants nothing on its own. It carries the `auth` rate limit for the same
     * reason the login route does.
     *
     * The other three are staff-audience — they manage the enrolment of an
     * account already signed in — and audited, because turning a second factor
     * off is exactly the change an attacker who got in would make.
     */
    [
        'method' => 'POST',
        'path' => '/admin/auth/mfa/verify',
        'handler' => [AuthController::class, 'verifyMfa'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'auth',
        'name' => 'admin.auth.mfa.verify',
        'rules' => [
            'challenge' => 'required|string|min:16|max:128',
            /* 21, because that is what a RECOVERY code is: `10hex-10hex`, and
               this route accepts one in place of a TOTP code. The bound is a
               length guard, not a format check — MfaService decides the shape.
               It read `max:16` while recovery codes were four hex either side of
               the dash; lengthening them to ten made the API reject every code
               it had just issued, with a 422 that named the field and not the
               reason. Anything that changes RECOVERY_CODES' shape changes this. */
            'code' => 'required|string|min:6|max:21',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/auth/mfa/begin',
        'handler' => [AuthController::class, 'beginMfa'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'auth',
        'audit' => true,
        /* STEP-UP REQUIRED. Without it a borrowed staff session could enrol its
           OWN authenticator: `disable` needs the password AND a current code, so
           the real owner — who has the password but not the attacker's secret —
           could never undo it. A password reset does not clear `user_mfa` either.
           The victim is locked out permanently and the attacker walks back in the
           moment they learn the new password. */
        'step_up' => true,
        'name' => 'admin.auth.mfa.begin',
    ],
    [
        'method' => 'POST',
        'path' => '/admin/auth/mfa/confirm',
        'handler' => [AuthController::class, 'confirmMfa'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'auth',
        'audit' => true,
        /* STEP-UP REQUIRED. Without it a borrowed staff session could enrol its
           OWN authenticator: `disable` needs the password AND a current code, so
           the real owner — who has the password but not the attacker's secret —
           could never undo it. A password reset does not clear `user_mfa` either.
           The victim is locked out permanently and the attacker walks back in the
           moment they learn the new password. */
        'step_up' => true,
        'name' => 'admin.auth.mfa.confirm',
        'rules' => ['code' => 'required|string|min:6|max:16'],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/auth/mfa/disable',
        'handler' => [AuthController::class, 'disableMfa'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'auth',
        'audit' => true,
        /* STEP-UP REQUIRED. Without it a borrowed staff session could enrol its
           OWN authenticator: `disable` needs the password AND a current code, so
           the real owner — who has the password but not the attacker's secret —
           could never undo it. A password reset does not clear `user_mfa` either.
           The victim is locked out permanently and the attacker walks back in the
           moment they learn the new password. */
        'step_up' => true,
        'name' => 'admin.auth.mfa.disable',
        'rules' => [
            'password' => 'required|string|min:1|max:200',
            /* 21 for the same reason as `verify` above: a recovery code is the
               honest way to turn MFA off when the authenticator is the thing you
               lost, so this route has to accept one. */
            'code' => 'required|string|min:6|max:21',
        ],
    ],

    /**
     * Proving the password again, for the actions a session alone is not enough
     * for. `auth` rate limit, because that is exactly what it is: without one it
     * would be a way to guess a staff password from inside a stolen session, at
     * network speed, leaving the account unlocked the whole time.
     */
    [
        'method' => 'POST',
        'path' => '/admin/auth/step-up',
        'handler' => [AuthController::class, 'stepUp'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'auth',
        'name' => 'admin.auth.step_up',
        'audit' => true,
        'rules' => ['password' => 'required|string|min:1|max:200'],
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
