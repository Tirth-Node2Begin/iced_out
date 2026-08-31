<?php

declare(strict_types=1);

namespace Iced\Integration\Payments;

use RuntimeException;

/**
 * A gateway call that did not happen, with a sentence fit to put in front of a
 * shopper.
 *
 * Deliberately NOT an ApiException, for the same reason as
 * `BackgroundRemovalFailed`: whether a failure here should fail the request is
 * the CALLER's decision, not the client's. Order creation degrades to the
 * amount-only checkout (the browser still gets a gateway); signature
 * verification does not degrade at all, because an unverified payment must
 * never be recorded as money.
 */
final class PaymentGatewayFailed extends RuntimeException
{
    public function __construct(
        string $message,
        /** True when trying again unchanged could plausibly work: a timeout, a 5xx, a rate limit. */
        public readonly bool $retryable = false,
    ) {
        parent::__construct($message);
    }
}
