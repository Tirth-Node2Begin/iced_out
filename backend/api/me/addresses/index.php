<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/addresses
 * POST /api/v1/me/addresses
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.addresses.index', 'me.addresses.create');
