<?php

declare(strict_types=1);

/**
 * POST   /api/v1/me/cart/coupon
 * DELETE /api/v1/me/cart/coupon
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.cart.coupon.apply', 'me.cart.coupon.clear');
