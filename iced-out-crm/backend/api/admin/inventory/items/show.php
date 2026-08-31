<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/inventory/items/{id}
 * DELETE /api/v1/admin/inventory/items/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.items.update', 'admin.inventory.items.delete');
