<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/reviews
 * POST /api/v1/admin/reviews
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.reviews.index', 'admin.reviews.create');
