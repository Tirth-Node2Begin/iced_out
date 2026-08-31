<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/inventory/warehouses
 * POST /api/v1/admin/inventory/warehouses
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.warehouses.index', 'admin.inventory.warehouses.create');
