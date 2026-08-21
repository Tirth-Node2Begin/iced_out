<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/support/queries/{reference}/reopen
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.support.reopen');
