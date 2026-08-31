<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/inventory/runs
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.inventory.runs.index', 'admin.inventory.runs.create');
