<?php

declare(strict_types=1);

/**
 * GET /api/v1/admin/crm/contacts/importable
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.contacts.importable');
