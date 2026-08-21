<?php

declare(strict_types=1);

/**
 * POST /api/v1/auth/login
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('auth.login');
