<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/vouchers
 * POST /api/v1/admin/vouchers
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.vouchers.index', 'admin.vouchers.create');
