<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/auth/mfa/begin
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.auth.mfa.begin');
