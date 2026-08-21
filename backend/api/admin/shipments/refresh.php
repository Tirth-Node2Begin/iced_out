<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/shipments/{id}/refresh
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.shipments.refresh');
