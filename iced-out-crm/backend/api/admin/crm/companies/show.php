<?php

declare(strict_types=1);

/**
 * GET, PATCH, DELETE /api/v1/admin/crm/companies/{company}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.companies.show', 'admin.crm.companies.update', 'admin.crm.companies.destroy');
