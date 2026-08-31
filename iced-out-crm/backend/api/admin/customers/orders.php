<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/customers/{id}/orders
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.customers.orders');
