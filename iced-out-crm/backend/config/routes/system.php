<?php

declare(strict_types=1);

use Iced\Controller\System\SystemController;
use Iced\Kernel\Route;

/**
 * Spec §8.1 — System (4 endpoints).
 *
 * Route definition keys:
 *   method, path, handler [class, method], audience, permission, idempotent,
 *   rate_limit (a class from config/app.php → rate_limits), rules, name, audit
 */
return [
    [
        'method' => 'GET',
        'path' => '/health',
        'handler' => [SystemController::class, 'health'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'name' => 'system.health',
    ],
    [
        'method' => 'GET',
        'path' => '/ready',
        'handler' => [SystemController::class, 'ready'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'name' => 'system.ready',
    ],
    [
        'method' => 'GET',
        'path' => '/version',
        'handler' => [SystemController::class, 'version'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'name' => 'system.version',
    ],
    [
        'method' => 'GET',
        'path' => '/config/storefront',
        'handler' => [SystemController::class, 'storefront'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'system.storefront_config',
    ],
];
