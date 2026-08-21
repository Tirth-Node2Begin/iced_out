<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/payouts/{id}/mark-paid
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.payouts.mark_paid');
