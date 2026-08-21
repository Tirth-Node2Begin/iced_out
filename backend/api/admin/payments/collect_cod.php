<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/payments/{id}/collect-cod
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.payments.collect_cod');
