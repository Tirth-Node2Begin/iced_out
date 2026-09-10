<?php

declare(strict_types=1);

/**
 * POST   /api/v1/me/cart/items
 * PATCH  /api/v1/me/cart/items
 * DELETE /api/v1/me/cart/items
 *
 * A line is addressed by (productId, size) in the payload, not by an id in the
 * path — both clients hold that pair already and neither holds a server id.
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.cart.items.add', 'me.cart.items.update', 'me.cart.items.remove');
