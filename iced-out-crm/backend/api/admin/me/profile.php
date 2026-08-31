<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/me/profile
 * PUT /api/v1/admin/me/profile
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.me.profile', 'admin.me.profile_update');
