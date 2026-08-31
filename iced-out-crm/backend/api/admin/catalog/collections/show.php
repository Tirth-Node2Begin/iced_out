<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/catalog/collections/{id}
 * DELETE /api/v1/admin/catalog/collections/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.collections.update', 'admin.catalog.collections.delete');
