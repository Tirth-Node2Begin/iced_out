<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/customers
 * POST /api/v1/admin/customers
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.customers.index', 'admin.customers.create');
