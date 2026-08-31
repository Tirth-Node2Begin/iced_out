<?php

declare(strict_types=1);

/**
 * GET, PATCH, DELETE /api/v1/admin/inventory/materials/{material}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.materials.show', 'admin.inventory.materials.update', 'admin.inventory.materials.delete');
