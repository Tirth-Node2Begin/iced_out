<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/catalog/variants
 * POST /api/v1/admin/catalog/variants
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.catalog.variants.index', 'admin.catalog.variants.create');
