<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/returns/{id}/history
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.returns.history');
