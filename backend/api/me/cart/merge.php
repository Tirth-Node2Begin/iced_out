<?php

declare(strict_types=1);

/**
 * POST /api/v1/me/cart/merge
 *
 * The guest bag, handed over at sign-in. Guests have no server cart by rule
 * (spec §8.8), so this is the one moment a device bag becomes an account bag.
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.cart.merge');
