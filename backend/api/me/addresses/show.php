<?php

declare(strict_types=1);

/**
 * PATCH /api/v1/me/addresses/{id}
 * DELETE /api/v1/me/addresses/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.addresses.update', 'me.addresses.delete');
