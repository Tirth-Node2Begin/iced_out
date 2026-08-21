<?php

declare(strict_types=1);

use Iced\Controller\Console\MediaController;
use Iced\Kernel\Route;

/** Spec §8.31 — media upload (staff) and the public read that serves it. */
return [
    [
        'method' => 'POST',
        'path' => '/admin/media',
        'handler' => [MediaController::class, 'upload'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'media.upload',
        'rate_limit' => 'console_write',
        'name' => 'admin.media.upload',
    ],
    [
        'method' => 'GET',
        'path' => '/media/{id}',
        'handler' => [MediaController::class, 'show'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'media.show',
    ],
];
