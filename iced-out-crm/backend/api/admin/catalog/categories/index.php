<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/catalog/categories
 * POST /api/v1/admin/catalog/categories
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.categories.index', 'admin.catalog.categories.create');
