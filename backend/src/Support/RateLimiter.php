<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Support\Cache\CacheStore;

/**
 * Fixed-window counters behind the limits table in spec §4.7.
 * Returns the numbers the X-RateLimit-* headers need, so the middleware stays dumb.
 */
final class RateLimiter
{
    public function __construct(private readonly CacheStore $store)
    {
    }

    /** @return array{allowed: bool, limit: int, remaining: int, reset_at: int, retry_after: int} */
    public function consume(string $key, int $limit, int $windowSeconds): array
    {
        $hit = $this->store->hit($key, $windowSeconds);
        $remaining = max(0, $limit - $hit['count']);

        return [
            'allowed' => $hit['count'] <= $limit,
            'limit' => $limit,
            'remaining' => $remaining,
            'reset_at' => $hit['reset_at'],
            'retry_after' => max(1, $hit['reset_at'] - time()),
        ];
    }
}
