<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/crm/activities/{activity}/complete
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.activities.complete');
