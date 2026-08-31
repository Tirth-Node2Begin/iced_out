<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class RateLimitException extends ApiException
{
    public function __construct(public readonly int $retryAfter, string $message = 'Too many requests. Please slow down and try again shortly.')
    {
        parent::__construct(429, 'ICE-RATE-429', $message, [], true);
    }
}
