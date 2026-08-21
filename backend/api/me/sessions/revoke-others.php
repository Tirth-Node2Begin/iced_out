<?php

declare(strict_types=1);

/**
 * POST /api/v1/me/sessions/revoke-others
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.sessions.revoke_others');
