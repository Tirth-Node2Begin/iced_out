<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/me/password
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.me.password');
