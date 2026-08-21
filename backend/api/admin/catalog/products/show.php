<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/catalog/products/{slug}
 * PATCH /api/v1/admin/catalog/products/{slug}
 * DELETE /api/v1/admin/catalog/products/{slug}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.products.show', 'admin.catalog.products.update', 'admin.catalog.products.delete');
