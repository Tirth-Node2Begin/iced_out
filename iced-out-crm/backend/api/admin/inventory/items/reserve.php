<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/inventory/items/{id}/reserve
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.items.reserve');
