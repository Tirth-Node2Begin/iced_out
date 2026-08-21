<?php

declare(strict_types=1);

/**
 * PUT /api/v1/me/photo
 * DELETE /api/v1/me/photo
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('me.photo.upload', 'me.photo.delete');
