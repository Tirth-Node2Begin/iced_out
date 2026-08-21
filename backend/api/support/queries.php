<?php

declare(strict_types=1);

/**
 * POST /api/v1/support/queries
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('support.queries.create');
