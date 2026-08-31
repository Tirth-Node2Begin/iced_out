<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/crm/activities
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.activities.index', 'admin.crm.activities.store');
