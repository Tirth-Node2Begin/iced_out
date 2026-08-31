<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/inventory/materials
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.materials.index', 'admin.inventory.materials.create');
