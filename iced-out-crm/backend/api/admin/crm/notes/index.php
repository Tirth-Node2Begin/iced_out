<?php

declare(strict_types=1);

/**
 * GET, POST /api/v1/admin/crm/notes
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('admin.crm.notes.index', 'admin.crm.notes.store');
