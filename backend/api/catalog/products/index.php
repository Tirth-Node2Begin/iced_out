<?php

declare(strict_types=1);

/**
 * GET /api/v1/catalog/products
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('catalog.products.index');
