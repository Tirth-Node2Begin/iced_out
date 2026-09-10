<?php

declare(strict_types=1);

namespace Iced\Support\Cache;

/**
 * Redis-free fallback (spec §1.4: "Redis 7 … a file/DB fallback when Redis is
 * absent"). Counters use flock so concurrent PHP-FPM workers cannot lose a hit.
 */
final class FileCacheStore implements CacheStore
{
    public function __construct(private readonly string $directory)
    {
        if (!is_dir($this->directory)) {
            @mkdir($this->directory, 0775, true);
        }
    }

    public function get(string $key): mixed
    {
        $path = $this->path($key);

        if (!is_file($path)) {
            return null;
        }

        $raw = @file_get_contents($path);

        if ($raw === false) {
            return null;
        }

        /** @var array{expires_at?: int, value?: mixed}|null $entry */
        $entry = json_decode($raw, true);

        if (!is_array($entry) || !isset($entry['expires_at']) || !is_int($entry['expires_at'])) {
            return null;
        }

        if ($entry['expires_at'] <= time()) {
            @unlink($path);

            return null;
        }

        return $entry['value'] ?? null;
    }

    public function put(string $key, mixed $value, int $ttlSeconds): void
    {
        $payload = json_encode([
            'expires_at' => time() + max(1, $ttlSeconds),
            'value' => $value,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($payload === false) {
            return;
        }

        @file_put_contents($this->path($key), $payload, LOCK_EX);
    }

    public function forget(string $key): void
    {
        @unlink($this->path($key));
    }

    public function hit(string $key, int $windowSeconds): array
    {
        $path = $this->path('counter:' . $key);
        $handle = @fopen($path, 'c+');

        if ($handle === false) {
            /* This used to `return ['count' => 1, ...]` — a plausible-looking
               "first request in the window" that quietly disabled every rate
               limit in the application for as long as the directory stayed
               unwritable. A permissions change on a deployment was enough, and
               nothing anywhere said so.

               Saying so is this class's whole job now; whether an unlimited
               endpoint or a refused one is the lesser harm is the caller's
               decision, and the two rate-limit middlewares make it per bucket. */
            throw new CacheUnavailable(sprintf('The counter store at %s could not be opened.', $this->directory));
        }

        try {
            /* The RETURN VALUE MATTERS. On a filesystem without advisory locking
               — some network mounts, some container overlays — `flock` returns
               false and the read-modify-write below proceeds unserialised, so
               concurrent workers overwrite each other's counts and every limit
               silently under-counts. Silent under-counting of the login bucket is
               the failure this class exists to prevent, so it is reported as a
               store that cannot be used rather than as a count that cannot be
               trusted. */
            if (!flock($handle, LOCK_EX)) {
                throw new CacheUnavailable(sprintf('The counter store at %s cannot be locked.', $this->directory));
            }

            $raw = stream_get_contents($handle);
            /** @var array{count?: int, reset_at?: int}|null $entry */
            $entry = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

            $now = time();
            $count = is_array($entry) && isset($entry['count']) && is_int($entry['count']) ? $entry['count'] : 0;
            $resetAt = is_array($entry) && isset($entry['reset_at']) && is_int($entry['reset_at']) ? $entry['reset_at'] : 0;

            if ($resetAt <= $now) {
                $count = 0;
                $resetAt = $now + $windowSeconds;
            }

            ++$count;

            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode(['count' => $count, 'reset_at' => $resetAt], JSON_UNESCAPED_SLASHES) ?: '');
            fflush($handle);

            return ['count' => $count, 'reset_at' => $resetAt];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * A mutex, and it has to be a real one.
     *
     * ── WHAT WAS WRONG ──────────────────────────────────────────────────────
     *
     * This was `is_file` → read → compare → `file_put_contents(…, LOCK_EX)`.
     * `LOCK_EX` there locks only the write; it does nothing about the gap
     * between reading the expiry and writing the new one. Two PHP-FPM workers
     * could both read an expired lock and both return `true`.
     *
     * Its one caller is `IdAllocator::allocate()`, which uses it as the
     * single-writer section around lowest-free-first id minting. Two checkouts
     * winning it together are handed the SAME `orders.public_id`, and the unique
     * index turns the loser into a 500 on an order the customer has already paid
     * for.
     *
     * `flock` on a held handle is the actual primitive. The handle is kept in
     * `$locks` for the life of the request, because a lock released by the
     * garbage collector is not a lock.
     *
     * @var array<string, resource>
     */
    private array $locks = [];

    public function lock(string $key, int $ttlSeconds): bool
    {
        $path = $this->path('lock:' . $key);

        if (isset($this->locks[$path])) {
            // Already held by this process; re-entrancy is not what callers mean.
            return false;
        }

        $handle = @fopen($path, 'c+');

        if ($handle === false) {
            return false;
        }

        // Non-blocking: a caller that cannot have it now wants to be told so,
        // not to hold a PHP-FPM worker open waiting.
        if (!flock($handle, LOCK_EX | LOCK_NB)) {
            fclose($handle);

            return false;
        }

        /* The TTL is written for observability and for the stale case: a worker
           killed mid-section drops its flock when the process dies, so the next
           caller acquires normally. The timestamp is what an operator reads when
           asking how long something has been held. */
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, (string) (time() + max(1, $ttlSeconds)));
        fflush($handle);

        $this->locks[$path] = $handle;

        return true;
    }

    public function unlock(string $key): void
    {
        $path = $this->path('lock:' . $key);

        if (!isset($this->locks[$path])) {
            /* Not ours. Deleting it here — which is what this used to do
               unconditionally — would release a lock another worker is holding. */
            return;
        }

        $handle = $this->locks[$path];
        unset($this->locks[$path]);

        flock($handle, LOCK_UN);
        fclose($handle);
    }

    /**
     * Deletes expired entries. Called by `console.php sweep`.
     *
     * Nothing removed these before: `get()` unlinks only the key it was asked
     * for, and counters were never cleaned at all. On a shared host the ceiling
     * that matters is the INODE quota, not disk, and an endpoint that can mint
     * keys is an endpoint that can exhaust it — after which `hit()` throws and
     * every fail-closed bucket answers 503.
     */
    public function prune(): int
    {
        $files = glob($this->directory . '/*.json');
        $now = time();
        $removed = 0;

        foreach ($files === false ? [] : $files as $file) {
            $raw = @file_get_contents($file);

            if ($raw === false || $raw === '') {
                continue;
            }

            /** @var array{expires_at?: int, reset_at?: int}|null $entry */
            $entry = json_decode($raw, true);

            if (!is_array($entry)) {
                continue;
            }

            // `put()` writes expires_at; `hit()` writes reset_at.
            $expiry = $entry['expires_at'] ?? $entry['reset_at'] ?? null;

            if (is_int($expiry) && $expiry <= $now && @unlink($file)) {
                ++$removed;
            }
        }

        return $removed;
    }

    private function path(string $key): string
    {
        return $this->directory . '/' . hash('sha256', $key) . '.json';
    }
}
