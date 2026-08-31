<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/admin/home/hero/{slide}
 * DELETE /api/v1/admin/home/hero/{slide}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.home.hero.update', 'admin.home.hero.delete');
