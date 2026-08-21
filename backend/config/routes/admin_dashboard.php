<?php

declare(strict_types=1);

use Iced\Controller\Console\DashboardController;
use Iced\Kernel\Route;

/** Spec §8.18 — console dashboard (5). Permission `dashboard.view`. */

$read = static fn (string $path, string $method, string $name): array => [
    'method' => 'GET',
    'path' => $path,
    'handler' => [DashboardController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'dashboard.view',
    'rate_limit' => 'console_read',
    'name' => $name,
];

return [
    $read('/admin/dashboard/queues', 'queues', 'admin.dashboard.queues'),
    $read('/admin/dashboard/trading', 'trading', 'admin.dashboard.trading'),
    $read('/admin/dashboard/activity', 'activity', 'admin.dashboard.activity'),
    $read('/admin/dashboard/pulse', 'pulse', 'admin.dashboard.pulse'),
    $read('/admin/dashboard/summary', 'summary', 'admin.dashboard.summary'),
];
