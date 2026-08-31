<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/inventory/purchases/{purchase}/transition
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.purchases.transition');
