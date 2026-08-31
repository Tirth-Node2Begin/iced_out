<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/shipments/ndr
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.shipments.ndr');
