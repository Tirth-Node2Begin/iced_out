<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/home/hero/order
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.home.hero.reorder');
