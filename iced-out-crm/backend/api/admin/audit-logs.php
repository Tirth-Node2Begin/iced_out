<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/audit-logs
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('admin.audit_logs');
