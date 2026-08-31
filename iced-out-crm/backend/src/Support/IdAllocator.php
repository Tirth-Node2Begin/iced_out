<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\ServiceUnavailableException;
use Iced\Support\Cache\CacheStore;
use InvalidArgumentException;

/**
 * Static-export ID registry (spec §11).
 *
 * `output: "export"` pre-renders dynamic routes only for the params baked at
 * build time, so a record created after the build has no page to land on unless
 * its public id comes from one of the reserved pools. Allocation is
 * lowest-free-first and pool bounds live in store_settings.id_pools, so
 * widening a pool after a frontend rebuild is a settings change, not a deploy.
 */
final class IdAllocator
{
    /**
     * Pool → the table/column that proves an id is taken. Hard-coded rather
     * than read from settings: these names reach SQL.
     *
     * @var array<string, array{table: string, column: string}>
     */
    private const SOURCES = [
        'order' => ['table' => 'orders', 'column' => 'public_id'],
        'tracking' => ['table' => 'shipments', 'column' => 'tracking_token'],
        'payment' => ['table' => 'payments', 'column' => 'public_id'],
        'customer' => ['table' => 'users', 'column' => 'public_id'],
    ];

    public function __construct(
        private readonly Database $db,
        private readonly CacheStore $cache,
    ) {
    }

    /**
     * @throws ServiceUnavailableException when the pool is exhausted — the
     *         message is the one operators need: rebuild the frontend with more slots.
     */
    public function allocate(string $pool): string
    {
        if (!isset(self::SOURCES[$pool])) {
            throw new InvalidArgumentException(sprintf('Unknown id pool "%s".', $pool));
        }

        $bounds = $this->bounds($pool);
        $source = self::SOURCES[$pool];

        $lock = 'idpool:' . $pool;

        if (!$this->cache->lock($lock, 5)) {
            throw new ServiceUnavailableException('The store is busy allocating ids. Please retry in a moment.');
        }

        try {
            $taken = [];

            foreach ($this->db->select(sprintf(
                'SELECT %s AS id FROM %s WHERE %s LIKE ?',
                $source['column'],
                $source['table'],
                $source['column'],
            ), [$bounds['prefix'] . '%']) as $row) {
                $taken[(string) $row['id']] = true;
            }

            /**
             * `to` of 0 means UNBOUNDED, which is now the normal case.
             *
             * These pools used to be capped at thirty because the frontend was a
             * static export that pre-rendered one page per id — so every id a
             * shopper could ever be given had to exist at build time. The
             * frontend reads the id from the query now, so there is nothing to
             * enumerate and no reason for a ceiling. The backstop below is a
             * runaway guard, not a quota.
             */
            $ceiling = $bounds['to'] > 0 ? $bounds['to'] : $bounds['from'] + 1_000_000;

            for ($serial = $bounds['from']; $serial <= $ceiling; ++$serial) {
                $candidate = $bounds['prefix'] . str_pad((string) $serial, $bounds['width'], '0', STR_PAD_LEFT);

                if (!isset($taken[$candidate])) {
                    return $candidate;
                }
            }
        } finally {
            $this->cache->unlock($lock);
        }

        throw new ServiceUnavailableException(sprintf(
            'Could not mint a %s id — the sequence is saturated.',
            $pool,
        ));
    }

    /**
     * Unbounded gap-filling ids (ret-072, shp-1051, IO-Q-1004): the lowest free
     * serial at or above `from`, mirroring the frontend's mintReturnId().
     */
    public function allocateGapFilling(string $table, string $column, string $prefix, int $width, int $from): string
    {
        if (preg_match('/^[a-z_]+$/', $table) !== 1 || preg_match('/^[a-z_]+$/', $column) !== 1) {
            throw new InvalidArgumentException('Table and column names must be plain identifiers.');
        }

        $taken = [];

        foreach ($this->db->select(sprintf('SELECT %s AS id FROM %s WHERE %s LIKE ?', $column, $table, $column), [$prefix . '%']) as $row) {
            $taken[(string) $row['id']] = true;
        }

        for ($serial = $from; $serial < $from + 100000; ++$serial) {
            $candidate = $prefix . str_pad((string) $serial, $width, '0', STR_PAD_LEFT);

            if (!isset($taken[$candidate])) {
                return $candidate;
            }
        }

        throw new ServiceUnavailableException('Could not mint an id — the sequence is saturated.');
    }

    /**
     * Order numbers (IO-2026-1049) are unbounded: pages address orders by their
     * pooled id, and findOrder() accepts the number too.
     */
    public function nextOrderNumber(): string
    {
        $settings = $this->setting('order_number');
        $prefix = is_string($settings['prefix'] ?? null) ? $settings['prefix'] : 'IO-2026-';
        $start = is_int($settings['next_serial'] ?? null) ? $settings['next_serial'] : 1049;

        $row = $this->db->selectOne(
            'SELECT number FROM orders WHERE number LIKE ? ORDER BY number DESC LIMIT 1',
            [$prefix . '%'],
        );

        $highest = $row === null ? $start - 1 : (int) substr((string) $row['number'], strlen($prefix));

        return $prefix . max($start, $highest + 1);
    }

    /** @return array{prefix: string, width: int, from: int, to: int} */
    private function bounds(string $pool): array
    {
        $pools = $this->setting('id_pools');
        /** @var array<string, mixed> $configured */
        $configured = is_array($pools[$pool] ?? null) ? $pools[$pool] : [];

        return [
            'prefix' => is_string($configured['prefix'] ?? null) ? $configured['prefix'] : $pool . '-',
            'width' => is_int($configured['width'] ?? null) ? $configured['width'] : 2,
            'from' => is_int($configured['from'] ?? null) ? $configured['from'] : 1,
            /* 0 = no ceiling, and that is the default: a pool is bounded only if a
               setting deliberately says so. See `allocate`. */
            'to' => is_int($configured['to'] ?? null) ? $configured['to'] : 0,
        ];
    }

    /** @return array<string, mixed> */
    private function setting(string $key): array
    {
        $row = $this->db->selectOne('SELECT value_json FROM store_settings WHERE `key` = ?', [$key]);

        if ($row === null) {
            return [];
        }

        $decoded = Json::decodeArray((string) $row['value_json']);

        /** @var array<string, mixed> $decoded */
        return $decoded ?? [];
    }
}
