<?php

declare(strict_types=1);

/**
 * POST   /api/v1/me/wishlist/{productId}
 * DELETE /api/v1/me/wishlist/{productId}
 *
 * The id is opaque — a product slug or a gender listing-tile id — and is
 * stored verbatim; see WishlistController.
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.wishlist.add', 'me.wishlist.remove');
