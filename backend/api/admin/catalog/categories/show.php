<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/catalog/categories/{id}
 * DELETE /api/v1/admin/catalog/categories/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.categories.update', 'admin.catalog.categories.delete');
