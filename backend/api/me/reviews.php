<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/reviews
 * POST /api/v1/me/reviews
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('me.reviews.index', 'me.reviews.create');
