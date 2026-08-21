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
            return ['count' => 1, 'reset_at' => time() + $windowSeconds];
        }

        try {
            flock($handle, LOCK_EX);

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

    public function lock(string $key, int $ttlSeconds): bool
    {
        $path = $this->path('lock:' . $key);

        if (is_file($path)) {
            $raw = @file_get_contents($path);
            $expiresAt = is_string($raw) ? (int) $raw : 0;

            if ($expiresAt > time()) {
                return false;
            }
        }

        return @file_put_contents($path, (string) (time() + max(1, $ttlSeconds)), LOCK_EX) !== false;
    }

    public function unlock(string $key): void
    {
        @unlink($this->path('lock:' . $key));
    }

    private function path(string $key): string
    {
        return $this->directory . '/' . hash('sha256', $key) . '.json';
    }
}
