<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/refunds
 * POST /api/v1/admin/refunds
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.refunds.index', 'admin.refunds.create');
