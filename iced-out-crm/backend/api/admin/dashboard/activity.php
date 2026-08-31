<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/dashboard/activity
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.dashboard.activity');
