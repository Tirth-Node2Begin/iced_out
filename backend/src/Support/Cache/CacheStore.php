<?php

declare(strict_types=1);

namespace Iced\Support\Cache;

/**
 * The seam Redis will slot into. Everything the app needs from a cache is here:
 * read/write with TTL, atomic counter (rate limits), and a lock (single-writer
 * sections such as id-pool allocation).
 */
interface CacheStore
{
    public function get(string $key): mixed;

    public function put(string $key, mixed $value, int $ttlSeconds): void;

    public function forget(string $key): void;

    /** @return array{count: int, reset_at: int} */
    public function hit(string $key, int $windowSeconds): array;

    public function lock(string $key, int $ttlSeconds): bool;

    public function unlock(string $key): void;
}
