<?php

declare(strict_types=1);

/**
 * POST /api/v1/admin/crm/deals/{deal}/move
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.deals.move');
