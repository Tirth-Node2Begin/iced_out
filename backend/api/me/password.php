<?php

declare(strict_types=1);

/**
 * POST /api/v1/me/password
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('me.password');
