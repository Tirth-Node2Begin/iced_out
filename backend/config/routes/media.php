<?php

declare(strict_types=1);

use Iced\Controller\System\MediaController;
use Iced\Kernel\Route;

/**
 * Spec §8.31 — media, READ half.
 *
 * POST /admin/media moved to the CRM backend with the rest of the console. The
 * storefront only ever reads: the CRM writes the bytes into the shared
 * MEDIA_ROOT and this serves them to shoppers.
 */
return [
    [
        'method' => 'GET',
        'path' => '/media/{id}',
        'handler' => [MediaController::class, 'show'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'media.show',
    ],
];
