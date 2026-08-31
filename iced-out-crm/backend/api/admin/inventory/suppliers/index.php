<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/inventory/suppliers
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.suppliers.index', 'admin.inventory.suppliers.create');
