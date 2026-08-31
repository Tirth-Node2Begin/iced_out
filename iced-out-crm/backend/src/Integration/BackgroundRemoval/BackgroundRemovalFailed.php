<?php

declare(strict_types=1);

namespace Iced\Integration\BackgroundRemoval;

use RuntimeException;

/**
 * A cutout that did not happen, with a sentence saying why that is fit to put
 * in front of an operator.
 *
 * Deliberately NOT an ApiException: a failed cutout must not fail the request
 * that asked for it. The slide is still saved, the original photograph is still
 * stored, and the console shows the reason next to a Retry — see
 * `GhostCutoutService`. Turning this into a 4xx would mean an expired API key
 * silently ate the operator's upload.
 */
final class BackgroundRemovalFailed extends RuntimeException
{
    public function __construct(
        string $message,
        /** True when trying again unchanged could plausibly work: a timeout, a 5xx, a rate limit. */
        public readonly bool $retryable = false,
    ) {
        parent::__construct($message);
    }
}
