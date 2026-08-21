<?php

declare(strict_types=1);

namespace Iced\Service\Settings;

use Iced\Kernel\Database;
use Iced\Support\Config;
use Iced\Support\Json;

/**
 * The one reader of `store_settings` — every policy value, threshold and
 * vocabulary the domain uses comes through here.
 *
 * The rule this class exists to enforce: **nothing an operator can change may
 * be a constant in PHP.** Delivery fees, the low-stock threshold, courier
 * names, return reasons, lockout windows and id series are all data, and data
 * lives in the database. A value hard-coded in a class is one an operator has
 * to file a deploy to change, and one that can silently disagree with what the
 * settings screen shows.
 *
 * Constants that stay constants are the ones that are *logic*, not policy:
 * state-machine transitions, HTTP semantics, storage formats, month names.
 *
 * Rows are read once per request (a single query for the whole table) and
 * cached on the instance. `config/app.php` supplies only the fallback used
 * before the settings are seeded, or if a key is deleted.
 */
final class StoreSettings
{
    /** @var array<string, mixed>|null */
    private ?array $values = null;

    public function __construct(
        private readonly Database $db,
        private readonly Config $config,
    ) {
    }

    /**
     * Dot-addressed: `delivery.standard_fee`, `shipping.fail_reasons`.
     * Falls back to `app.storefront.*` in config, then to the given default.
     */
    public function get(string $path, mixed $default = null): mixed
    {
        $segments = explode('.', $path);
        $key = array_shift($segments);

        if ($key === null) {
            return $default;
        }

        $value = $this->all()[$key] ?? null;

        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }

            $value = $value[$segment];
        }

        return $value ?? $default;
    }

    public function int(string $path, int $default): int
    {
        $value = $this->get($path);

        return is_numeric($value) ? (int) $value : $default;
    }

    public function string(string $path, string $default = ''): string
    {
        $value = $this->get($path);

        return is_string($value) && $value !== '' ? $value : $default;
    }

    public function bool(string $path, bool $default): bool
    {
        $value = $this->get($path);

        return is_bool($value) ? $value : $default;
    }

    /**
     * A vocabulary — the allowed values of a field. Empty settings fall back to
     * the given list so a wiped table cannot make every write invalid.
     *
     * @param list<string> $default
     *
     * @return list<string>
     */
    public function vocabulary(string $path, array $default = []): array
    {
        $value = $this->get($path);

        if (!is_array($value) || $value === []) {
            return $default;
        }

        return array_values(array_map(static fn (mixed $entry): string => (string) $entry, $value));
    }

    /**
     * @param array<array-key, mixed> $default
     *
     * @return array<array-key, mixed>
     */
    public function map(string $path, array $default = []): array
    {
        $value = $this->get($path);

        return is_array($value) && $value !== [] ? $value : $default;
    }

    /**
     * The next number in a named series (shipments, pickups, reviews, support
     * references). The floor lives in settings; the actual next value is always
     * derived from what the table already holds, so a settings edit can raise
     * the floor but never mint a duplicate.
     *
     * @return array{prefix: string, width: int, from: int}
     */
    public function series(string $name, string $prefix, int $from, int $width = 0): array
    {
        /** @var array<string, mixed> $configured */
        $configured = $this->map('id_series.' . $name);

        return [
            'prefix' => is_string($configured['prefix'] ?? null) ? $configured['prefix'] : $prefix,
            'width' => is_int($configured['width'] ?? null) ? $configured['width'] : $width,
            'from' => is_int($configured['from'] ?? null) ? $configured['from'] : $from,
        ];
    }

    /** Called after a settings write so the rest of the request sees the new value. */
    public function forget(): void
    {
        $this->values = null;
    }

    /** @return array<string, mixed> */
    private function all(): array
    {
        if ($this->values !== null) {
            return $this->values;
        }

        $values = [];

        try {
            foreach ($this->db->select('SELECT `key`, value_json FROM store_settings') as $row) {
                $values[(string) $row['key']] = Json::decodeArray((string) $row['value_json']) ?? [];
            }
        } catch (\Throwable) {
            // Before the first migration there is no table yet; the config
            // fallbacks below are what boot the app in that window.
            $values = [];
        }

        if ($values === []) {
            /** @var array<string, mixed> $fallback */
            $fallback = $this->config->array('app.storefront');
            $values = $fallback;
        }

        return $this->values = $values;
    }
}
