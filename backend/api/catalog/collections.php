<?php

declare(strict_types=1);

/**
 * GET /api/v1/catalog/collections
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('catalog.collections.index');
