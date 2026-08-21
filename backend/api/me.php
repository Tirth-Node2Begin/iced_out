<?php

declare(strict_types=1);

/**
 * GET /api/v1/me
 * PATCH /api/v1/me
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/bootstrap.php';

Endpoint::serve('me.show', 'me.update');
