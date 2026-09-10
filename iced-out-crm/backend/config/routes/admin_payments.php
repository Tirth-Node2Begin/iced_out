<?php

declare(strict_types=1);

use Iced\Controller\Console\PaymentController;
use Iced\Kernel\Route;

/** Spec §8.25 — console payments, refunds, payouts (10). */

$read = static fn (string $path, string $method, string $name, string $permission = 'payments.view'): array => [
    'method' => 'GET',
    'path' => $path,
    'handler' => [PaymentController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => $permission,
    'rate_limit' => 'console_read',
    'name' => $name,
];

return [
    $read('/admin/payments', 'index', 'admin.payments.index'),
    // Static before dynamic is a router rule, but keeping the literal first here
    // documents that /admin/payments/export is not a payment id.
    //
    /* array_merge, NOT `+`.
     *
     * This read `$read(...) + ['rate_limit' => 'exports']`, which looks like an
     * override and is the opposite of one: PHP's array union keeps the LEFT
     * operand on a key collision, and `$read` already sets
     * `'rate_limit' => 'console_read'`. So the tightest limit in the config was
     * silently discarded and this route ran at 300/minute instead of 5/hour —
     * 3600x — while the method's own docblock said "rate-limited 5/hour" and
     * every reviewer since has read that line and believed it.
     *
     * It matters because of what the route returns: every payment in a date
     * range, in one response, with no upper bound on the range. That is the
     * whole payments table for anyone who can call it, and `console_read` let
     * them call it five times a second.
     *
     * `array_merge` gives the right-hand side precedence, which is what the `+`
     * was written to mean. Every other `+ [...]` in the route files adds `rules`,
     * a key no builder sets, so they are unaffected — this was the only collision.
     */
    array_merge(
        $read('/admin/payments/export', 'export', 'admin.payments.export', 'payments.exports.create'),
        [
            'rate_limit' => 'exports',
            /* Bulk financial data leaving the system is exactly the event an
               investigation starts from, and a GET left no trace at all. */
            'audit' => true,
        ],
    ),
    $read('/admin/payments/{id}', 'show', 'admin.payments.show'),
    $read('/admin/refunds', 'refunds', 'admin.refunds.index'),
    $read('/admin/payouts', 'payouts', 'admin.payouts.index'),

    [
        'method' => 'POST',
        'path' => '/admin/payments/{id}/collect-cod',
        'handler' => [PaymentController::class, 'collectCod'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'payments.reconcile',
        'rate_limit' => 'console_write',
        'idempotent' => true,
        'name' => 'admin.payments.collect_cod',
    ],
    [
        'method' => 'POST',
        'path' => '/admin/payments/{id}/gateway-check',
        'handler' => [PaymentController::class, 'gatewayCheck'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'payments.reconcile',
        'rate_limit' => 'console_write',
        'name' => 'admin.payments.gateway_check',
    ],
    [
        'method' => 'POST',
        'path' => '/admin/refunds',
        'handler' => [PaymentController::class, 'createRefund'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'refunds.request',
        'rate_limit' => 'console_write',
        'idempotent' => true,
        'step_up' => true,   // refund creation moves real money
        'name' => 'admin.refunds.create',
        // The reason vocabulary lives in store_settings and is checked in the
        // controller against whatever the table says today.
        'rules' => [
            'payment' => 'required|string|max:40',
            'amount' => 'required|int|min:1|max:10000000',
            'reason' => 'required|string|max:40',
        ],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/refunds/{id}/transition',
        'handler' => [PaymentController::class, 'transitionRefund'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'refunds.approve',
        'rate_limit' => 'console_write',
        'step_up' => true,   // refund approval moves real money
        'name' => 'admin.refunds.transition',
        'rules' => ['status' => 'required|string|in:Processing,Succeeded,Failed'],
    ],
    [
        'method' => 'POST',
        'path' => '/admin/payouts/{id}/mark-paid',
        'handler' => [PaymentController::class, 'markPayoutPaid'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'payments.reconcile',
        'rate_limit' => 'console_write',
        'step_up' => true,   // payout settlement moves real money
        'name' => 'admin.payouts.mark_paid',
    ],
];
