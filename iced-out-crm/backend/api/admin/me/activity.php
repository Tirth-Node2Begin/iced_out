<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/me/activity
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.me.activity');
