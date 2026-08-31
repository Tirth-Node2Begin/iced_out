<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/crm/deals
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.deals.board', 'admin.crm.deals.store');
