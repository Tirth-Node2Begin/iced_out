<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/inventory/movements
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.inventory.movements');
