<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/inventory/at-risk
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.inventory.at_risk');
