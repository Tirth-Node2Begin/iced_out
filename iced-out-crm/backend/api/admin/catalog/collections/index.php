<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/catalog/collections
 * POST /api/v1/admin/catalog/collections
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.collections.index', 'admin.catalog.collections.create');
