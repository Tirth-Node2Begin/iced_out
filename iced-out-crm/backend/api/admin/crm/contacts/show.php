<?php

declare(strict_types=1);

/**
 * GET, PATCH, DELETE /api/v1/admin/crm/contacts/{contact}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.contacts.show', 'admin.crm.contacts.update', 'admin.crm.contacts.destroy');
