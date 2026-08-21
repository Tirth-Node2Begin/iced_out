<?php

declare(strict_types=1);

namespace Iced\Support;

/**
 * Dot-addressable view over config/*.php. Files are loaded lazily and cached:
 * Config::get('app.base_path') reads config/app.php once.
 */
final class Config
{
    /** @var array<string, mixed> */
    private array $loaded = [];

    public function __construct(private readonly string $directory)
    {
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $segments = explode('.', $key);
        $file = array_shift($segments);

        if ($file === null || $file === '') {
            return $default;
        }

        $value = $this->file($file);

        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }

            $value = $value[$segment];
        }

        return $value;
    }

    public function string(string $key, string $default = ''): string
    {
        $value = $this->get($key, $default);

        return is_scalar($value) ? (string) $value : $default;
    }

    public function int(string $key, int $default = 0): int
    {
        $value = $this->get($key, $default);

        return is_numeric($value) ? (int) $value : $default;
    }

    public function bool(string $key, bool $default = false): bool
    {
        $value = $this->get($key, $default);

        return is_bool($value) ? $value : $default;
    }

    /** @return array<array-key, mixed> */
    public function array(string $key): array
    {
        $value = $this->get($key, []);

        return is_array($value) ? $value : [];
    }

    /** @return array<array-key, mixed> */
    private function file(string $name): array
    {
        if (!array_key_exists($name, $this->loaded)) {
            $path = $this->directory . '/' . $name . '.php';
            $loaded = is_file($path) ? require $path : [];
            $this->loaded[$name] = is_array($loaded) ? $loaded : [];
        }

        /** @var array<array-key, mixed> $value */
        $value = $this->loaded[$name];

        return $value;
    }
}
