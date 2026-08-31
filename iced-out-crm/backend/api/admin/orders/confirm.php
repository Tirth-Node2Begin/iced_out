<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/orders/{number}/confirm
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.orders.confirm');
