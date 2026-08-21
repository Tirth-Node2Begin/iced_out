<?php

declare(strict_types=1);

/**
 * POST /api/v1/checkout/orders
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('checkout.orders.place');
