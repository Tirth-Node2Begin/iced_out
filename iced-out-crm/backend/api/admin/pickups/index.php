<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/pickups
 * POST /api/v1/admin/pickups
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.pickups.index', 'admin.pickups.create');
