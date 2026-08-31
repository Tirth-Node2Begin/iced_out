<?php

declare(strict_types=1);

/**
 * GET, DELETE /api/v1/admin/inventory/runs/{run}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.runs.show', 'admin.inventory.runs.delete');
