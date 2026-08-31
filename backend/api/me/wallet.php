<?php

declare(strict_types=1);

/**
 * GET /api/v1/me/wallet
 *
 * The sibling directory holds the actions on it (wallet/redeem.php); this file
 * is the read, which is why it sits beside them rather than inside as an index.
 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('me.wallet.show');
