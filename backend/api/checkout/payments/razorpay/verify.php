<?php

declare(strict_types=1);

/**
 * POST /api/v1/checkout/payments/razorpay/verify
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../../bootstrap.php';

Endpoint::serve('checkout.payments.razorpay.verify');
