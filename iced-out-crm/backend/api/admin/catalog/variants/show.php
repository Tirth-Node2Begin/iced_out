<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/catalog/variants/{sku}
 * DELETE /api/v1/admin/catalog/variants/{sku}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.variants.update', 'admin.catalog.variants.archive');
