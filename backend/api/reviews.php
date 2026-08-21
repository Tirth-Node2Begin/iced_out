<?php

declare(strict_types=1);

/**
 * GET /api/v1/reviews
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/bootstrap.php';

Endpoint::serve('reviews.index');
