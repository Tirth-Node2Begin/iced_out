<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/inventory/transfers
 * POST /api/v1/admin/inventory/transfers
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.transfers.index', 'admin.inventory.transfers.create');
