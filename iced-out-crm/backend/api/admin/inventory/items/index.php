<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/inventory/items
 * POST /api/v1/admin/inventory/items
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.items.index', 'admin.inventory.items.create');
