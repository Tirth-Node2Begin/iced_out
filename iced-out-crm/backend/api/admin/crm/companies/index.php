<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/crm/companies
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.companies.index', 'admin.crm.companies.store');
