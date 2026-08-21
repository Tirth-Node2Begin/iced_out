<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/returns
 * POST /api/v1/me/returns
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('me.returns.index', 'me.returns.create');
