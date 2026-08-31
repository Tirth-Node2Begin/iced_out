<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/crm/contacts
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.contacts.index', 'admin.crm.contacts.store');
