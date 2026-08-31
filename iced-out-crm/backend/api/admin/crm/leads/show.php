<?php

declare(strict_types=1);

/**
 * GET, PATCH, DELETE /api/v1/admin/crm/leads/{lead}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.leads.show', 'admin.crm.leads.update', 'admin.crm.leads.destroy');
