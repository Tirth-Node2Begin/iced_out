<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/reviews/{id}/publish
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.reviews.publish');
