<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/sessions
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.sessions.index');
