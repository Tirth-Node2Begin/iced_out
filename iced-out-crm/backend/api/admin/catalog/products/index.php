<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/catalog/products
 * POST /api/v1/admin/catalog/products
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.products.index', 'admin.catalog.products.create');
