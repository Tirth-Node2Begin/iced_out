<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/orders/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.orders.show');
