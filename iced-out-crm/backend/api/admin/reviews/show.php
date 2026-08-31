<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/reviews/{id}
 * DELETE /api/v1/admin/reviews/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.reviews.update', 'admin.reviews.delete');
