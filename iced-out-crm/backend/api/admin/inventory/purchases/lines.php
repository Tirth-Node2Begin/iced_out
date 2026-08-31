<?php

declare(strict_types=1);

/**
 * PUT /api/v1/admin/inventory/purchases/{purchase}/lines
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.purchases.lines');
