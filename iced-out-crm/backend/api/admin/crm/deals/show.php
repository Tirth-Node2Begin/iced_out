<?php

declare(strict_types=1);

/**
 * GET, PATCH, DELETE /api/v1/admin/crm/deals/{deal}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.deals.show', 'admin.crm.deals.update', 'admin.crm.deals.destroy');
