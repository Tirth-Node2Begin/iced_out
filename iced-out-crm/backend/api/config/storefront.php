<?php

declare(strict_types=1);

/**
 * GET /api/v1/config/storefront
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('system.storefront_config');
