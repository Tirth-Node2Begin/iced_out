<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/inventory/materials/{material}/adjust
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.materials.adjust');
