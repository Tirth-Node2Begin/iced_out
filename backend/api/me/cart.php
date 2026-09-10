<?php

declare(strict_types=1);

/**
 * GET    /api/v1/me/cart
 * DELETE /api/v1/me/cart
 *
 * The sibling directory holds the actions on it (cart/items.php,
 * cart/coupon.php, cart/merge.php); this file is the read and the emptying,
 * which is why it sits beside them rather than inside as an index.
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('me.cart.show', 'me.cart.clear');
