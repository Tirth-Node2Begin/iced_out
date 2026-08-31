<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/inventory/purchases
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.purchases.index', 'admin.inventory.purchases.create');
