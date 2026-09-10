<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/auth/mfa/confirm
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.auth.mfa.confirm');
