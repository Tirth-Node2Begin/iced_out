<?php

declare(strict_types=1);

/**
 * POST /api/v1/webhooks/razorpay
 *
 * Register this URL in the Razorpay dashboard against the events
 * payment.captured, payment.authorized, payment.failed and order.paid, and put
 * the secret it gives you in RAZORPAY_WEBHOOK_SECRET.
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('webhooks.razorpay');
