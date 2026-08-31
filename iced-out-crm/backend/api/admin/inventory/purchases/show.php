<?php

declare(strict_types=1);

/**
 * GET, DELETE /api/v1/admin/inventory/purchases/{purchase}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.purchases.show', 'admin.inventory.purchases.delete');
