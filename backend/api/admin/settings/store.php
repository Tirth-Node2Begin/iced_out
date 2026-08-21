<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/settings/store
 * PUT /api/v1/admin/settings/store
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('admin.settings.show', 'admin.settings.update');
