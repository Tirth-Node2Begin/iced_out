<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Support\Cache\CacheStore;
use Iced\Support\Cache\CacheUnavailable;

/**
 * Fixed-window counters behind the limits table in spec §4.7.
 * Returns the numbers the X-RateLimit-* headers need, so the middleware stays dumb.
 *
 * `available` is the one addition, and it exists because a rate limiter that
 * cannot count has to say so. The file store used to answer "one hit" when it
 * could not open its counter — indistinguishable from a quiet shop, and in
 * effect every limit in the application switched off. Now the failure travels as
 * far as the middleware, which decides per bucket whether unlimited or refused
 * is the lesser harm.
 */
final class RateLimiter
{
    public function __construct(private readonly CacheStore $store)
    {
    }

    /** @return array{allowed: bool, limit: int, remaining: int, reset_at: int, retry_after: int, available: bool} */
    public function consume(string $key, int $limit, int $windowSeconds): array
    {
        try {
            $hit = $this->store->hit($key, $windowSeconds);
        } catch (CacheUnavailable) {
            return [
                'allowed' => true,
                'limit' => $limit,
                'remaining' => $limit,
                'reset_at' => time() + $windowSeconds,
                'retry_after' => $windowSeconds,
                // The caller must not treat `allowed` above as a decision.
                'available' => false,
            ];
        }

        $remaining = max(0, $limit - $hit['count']);

        return [
            'allowed' => $hit['count'] <= $limit,
            'limit' => $limit,
            'remaining' => $remaining,
            'reset_at' => $hit['reset_at'],
            'retry_after' => max(1, $hit['reset_at'] - time()),
            'available' => true,
        ];
    }
}
