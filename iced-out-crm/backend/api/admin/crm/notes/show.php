<?php

declare(strict_types=1);

/**
 * PATCH, DELETE /api/v1/admin/crm/notes/{note}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.notes.update', 'admin.crm.notes.destroy');
