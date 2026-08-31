<?php

declare(strict_types=1);

/**
 * PATCH, DELETE /api/v1/admin/inventory/suppliers/{supplier}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.suppliers.update', 'admin.inventory.suppliers.delete');
