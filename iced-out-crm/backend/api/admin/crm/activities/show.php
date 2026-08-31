<?php

declare(strict_types=1);

/**
 * PATCH, DELETE /api/v1/admin/crm/activities/{activity}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.activities.update', 'admin.crm.activities.destroy');
