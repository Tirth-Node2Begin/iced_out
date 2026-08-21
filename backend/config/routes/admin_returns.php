<?php

declare(strict_types=1);

use Iced\Controller\Console\ReturnController;
use Iced\Controller\Console\VoucherController;
use Iced\Kernel\Route;

/** Spec §8.23 returns (8) and §8.24 vouchers (4). */

$returnAction = static fn (string $path, string $method, string $name, bool $idem = false): array => [
    'method' => 'POST',
    'path' => $path,
    'handler' => [ReturnController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'returns.approve',
    'rate_limit' => 'console_write',
    'idempotent' => $idem,
    'name' => $name,
];

return [
    [
        'method' => 'GET',
        'path' => '/admin/returns',
        'handler' => [ReturnController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'returns.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.returns.index',
    ],
    [
        'method' => 'GET',
        'path' => '/admin/returns/{id}',
        'handler' => [ReturnController::class, 'show'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'returns.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.returns.show',
    ],
    [
        'method' => 'GET',
        'path' => '/admin/returns/{id}/history',
        'handler' => [ReturnController::class, 'history'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'returns.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.returns.history',
    ],
    $returnAction('/admin/returns/{id}/approve', 'approve', 'admin.returns.approve'),
    $returnAction('/admin/returns/{id}/reject', 'reject', 'admin.returns.reject'),
    // [idem] — collecting money and issuing credit must never happen twice on a retry.
    $returnAction('/admin/returns/{id}/collect-payment', 'collectPayment', 'admin.returns.collect_payment', true),
    $returnAction('/admin/returns/{id}/settle', 'settle', 'admin.returns.settle', true),

    [
        'method' => 'GET',
        'path' => '/admin/vouchers',
        'handler' => [VoucherController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'coupons.manage',
        'rate_limit' => 'console_read',
        'name' => 'admin.vouchers.index',
    ],
    [
        'method' => 'POST',
        'path' => '/admin/vouchers',
        'handler' => [VoucherController::class, 'create'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'coupons.manage',
        'rate_limit' => 'console_write',
        'name' => 'admin.vouchers.create',
        'rules' => [
            'customer' => 'required|string|max:120',
            'amount' => 'required|int|min:1|max:1000000',
            'reason' => 'required|string|max:160',
            'expiresOn' => 'required|string|regex:/^\d{4}-\d{2}-\d{2}$/',
        ],
    ],
    [
        'method' => 'PATCH',
        'path' => '/admin/vouchers/{code}',
        'handler' => [VoucherController::class, 'update'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'coupons.manage',
        'rate_limit' => 'console_write',
        'name' => 'admin.vouchers.update',
        'rules' => [
            'amount' => 'int|min:1|max:1000000',
            'reason' => 'string|max:160',
            'expiresOn' => 'string|regex:/^\d{4}-\d{2}-\d{2}$/',
        ],
    ],
    [
        'method' => 'DELETE',
        'path' => '/admin/vouchers/{code}',
        'handler' => [VoucherController::class, 'void'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'coupons.manage',
        'rate_limit' => 'console_write',
        'name' => 'admin.vouchers.void',
    ],
];
