<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/home/hero
 * POST /api/v1/admin/home/hero
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.home.hero.index', 'admin.home.hero.create');
