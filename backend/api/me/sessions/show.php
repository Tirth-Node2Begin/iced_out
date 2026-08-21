<?php

declare(strict_types=1);

/**
 * DELETE /api/v1/me/sessions/{id}
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.sessions.revoke');
