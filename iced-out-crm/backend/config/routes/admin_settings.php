<?php

declare(strict_types=1);

use Iced\Controller\Console\AnalyticsController;
use Iced\Controller\Console\SettingsController;
use Iced\Kernel\Route;

/** Spec §8.29 analytics (3) and §8.30 settings + staff profile (7). */
return [
    /* ------------------------------------------------------------ analytics */
    [
        'method' => 'GET', 'path' => '/admin/analytics/overview',
        'handler' => [AnalyticsController::class, 'overview'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reports.operational.view',
        'rate_limit' => 'console_read', 'name' => 'admin.analytics.overview',
    ],
    [
        'method' => 'GET', 'path' => '/admin/analytics/breakdowns',
        'handler' => [AnalyticsController::class, 'breakdowns'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reports.operational.view',
        'rate_limit' => 'console_read', 'name' => 'admin.analytics.breakdowns',
    ],
    [
        'method' => 'POST', 'path' => '/admin/analytics/export',
        'handler' => [AnalyticsController::class, 'export'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'reports.operational.view',
        'rate_limit' => 'exports', 'name' => 'admin.analytics.export',
        'rules' => ['window' => 'string|max:16'],
    ],

    /* ------------------------------------------------------------- settings */
    [
        'method' => 'GET', 'path' => '/admin/settings/store',
        'handler' => [SettingsController::class, 'showStore'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'settings.manage',
        'rate_limit' => 'console_read', 'name' => 'admin.settings.show',
    ],
    [
        'method' => 'PUT', 'path' => '/admin/settings/store',
        'handler' => [SettingsController::class, 'updateStore'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'settings.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.settings.update',
    ],

    /* -------------------------------------------- the staff member's own account */
    [
        'method' => 'GET', 'path' => '/admin/me/profile',
        'handler' => [SettingsController::class, 'profile'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'console_read', 'name' => 'admin.me.profile',
    ],
    [
        'method' => 'PUT', 'path' => '/admin/me/profile',
        'handler' => [SettingsController::class, 'updateProfile'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'console_write', 'name' => 'admin.me.profile_update',
        'rules' => [
            'name' => 'string|min:2|max:120',
            'phone' => 'string|max:20',
        ],
    ],
    [
        'method' => 'POST', 'path' => '/admin/me/password',
        'handler' => [SettingsController::class, 'changePassword'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'console_write', 'name' => 'admin.me.password',
        'rules' => [
            'current' => 'required|string|min:1|max:200',
            'next' => 'required|string|min:8|max:200',
        ],
    ],
    [
        'method' => 'GET', 'path' => '/admin/me/activity',
        'handler' => [SettingsController::class, 'activity'],
        'audience' => Route::AUDIENCE_STAFF,
        'rate_limit' => 'console_read', 'name' => 'admin.me.activity',
    ],
    [
        'method' => 'GET', 'path' => '/admin/audit-logs',
        'handler' => [SettingsController::class, 'auditLogs'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'audit.view',
        'rate_limit' => 'console_read', 'name' => 'admin.audit_logs',
    ],
];
