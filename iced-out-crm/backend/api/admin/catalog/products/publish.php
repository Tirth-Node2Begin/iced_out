<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/catalog/products/{slug}/publish
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.products.publish');
