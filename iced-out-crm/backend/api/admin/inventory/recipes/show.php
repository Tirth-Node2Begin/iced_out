<?php

declare(strict_types=1);

/**
 * GET, PUT /api/v1/admin/inventory/recipes/{item}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.recipes.show', 'admin.inventory.recipes.update');
