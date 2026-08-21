<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/checkout/draft
 * PUT /api/v1/me/checkout/draft
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../../bootstrap.php';

Endpoint::serve('me.checkout.draft', 'me.checkout.draft_save');
