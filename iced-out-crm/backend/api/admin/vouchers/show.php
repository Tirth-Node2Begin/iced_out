<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/vouchers/{code}
 * DELETE /api/v1/admin/vouchers/{code}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.vouchers.update', 'admin.vouchers.void');
