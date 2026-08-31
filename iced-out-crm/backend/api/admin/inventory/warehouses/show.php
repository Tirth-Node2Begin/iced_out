<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/inventory/warehouses/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.warehouses.update');
