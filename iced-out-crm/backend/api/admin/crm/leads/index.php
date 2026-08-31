<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/crm/leads
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.leads.index', 'admin.crm.leads.store');
