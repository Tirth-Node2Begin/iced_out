<?php

declare(strict_types=1);

/**
 * GET /api/v1/checkout/delivery-options
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('checkout.delivery_options');
