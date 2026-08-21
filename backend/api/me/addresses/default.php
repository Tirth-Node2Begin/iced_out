<?php

declare(strict_types=1);

/**
 * POST /api/v1/me/addresses/{id}/default
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.addresses.make_default');
