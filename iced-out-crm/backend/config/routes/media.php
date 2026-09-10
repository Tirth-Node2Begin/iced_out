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
        /* `uploads` (10/hour), NOT `console_write` (60/minute).

           Both keys were present. PHP does not warn on a duplicate key in an
           array literal — it silently keeps the last — so this route has been
           running at 360x its intended allowance, and the line naming the right
           bucket sat directly above it looking correct.

           The difference matters on a shared cPanel plan where the disk quota is
           the whole account: `uploads` is the bucket sized for something that
           writes a file per request, and it is scoped per principal so one
           compromised staff session cannot fill the volume in an afternoon. */
        'rate_limit' => 'uploads',
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
