<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/wishlist
 * PUT /api/v1/me/wishlist
 *
 * PUT is a full replace, which is how a sign-in merge is done: the client
 * unions the server list with the device list and puts the result.
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.wishlist.show', 'me.wishlist.replace');
