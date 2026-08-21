<?php

declare(strict_types=1);

/**
 * GET /api/v1/home/hero
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('home.hero');
