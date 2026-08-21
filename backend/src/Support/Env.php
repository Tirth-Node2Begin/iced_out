<?php

declare(strict_types=1);

namespace Iced\Support;

/**
 * The single reader of environment values. Loads backend/.env once (KEY=VALUE,
 * `#` comments, optional quotes) and layers real environment variables on top,
 * so a container/CI env always wins over the file.
 */
final class Env
{
    /** @var array<string, string>|null */
    private static ?array $values = null;

    public static function load(string $file): void
    {
        $values = [];

        if (is_file($file)) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

            foreach ($lines === false ? [] : $lines as $line) {
                $line = trim($line);

                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }

                $parts = explode('=', $line, 2);

                if (count($parts) !== 2) {
                    continue;
                }

                $key = trim($parts[0]);
                $value = trim($parts[1]);

                if (strlen($value) >= 2) {
                    $first = $value[0];
                    $last = $value[strlen($value) - 1];

                    if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                        $value = substr($value, 1, -1);
                    }
                }

                $values[$key] = $value;
            }
        }

        foreach ($_ENV as $key => $value) {
            if (is_string($key) && is_scalar($value)) {
                $values[$key] = (string) $value;
            }
        }

        foreach ($_SERVER as $key => $value) {
            if (is_string($key) && is_string($value)) {
                $values[$key] = $value;
            }
        }

        self::$values = $values;
    }

    public static function string(string $key, string $default = ''): string
    {
        $raw = self::raw($key);

        return $raw === null || $raw === '' ? $default : $raw;
    }

    public static function int(string $key, int $default = 0): int
    {
        $raw = self::raw($key);

        return $raw === null || $raw === '' ? $default : (int) $raw;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $raw = self::raw($key);

        if ($raw === null || $raw === '') {
            return $default;
        }

        return in_array(strtolower($raw), ['1', 'true', 'yes', 'on'], true);
    }

    /** @return list<string> */
    public static function list(string $key, string $default = ''): array
    {
        $raw = self::string($key, $default);

        if ($raw === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(',', $raw)), static fn (string $v): bool => $v !== ''));
    }

    /**
     * A real environment variable always wins over the .env file.
     *
     * That is what makes a container, a CI job or a test run able to point at a
     * different database without editing — and rewriting — the file the
     * developer is working with. `DB_NAME=iced_out_test php …` is the reason
     * this precedence matters: the test suites must never be able to drop the
     * database someone has accounts in.
     */
    private static function raw(string $key): ?string
    {
        $fromProcess = getenv($key);

        if ($fromProcess !== false && $fromProcess !== '') {
            return $fromProcess;
        }

        if (self::$values === null) {
            self::$values = [];
        }

        return self::$values[$key] ?? ($fromProcess === false ? null : $fromProcess);
    }
}
