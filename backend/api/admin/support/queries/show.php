<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/support/queries/{reference}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.support.show');
