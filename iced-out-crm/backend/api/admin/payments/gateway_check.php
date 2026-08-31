<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/payments/{id}/gateway-check
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.payments.gateway_check');
