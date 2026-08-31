<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/support/queries/{reference}/resolve
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.support.resolve');
