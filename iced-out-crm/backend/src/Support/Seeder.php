<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Container;
use RuntimeException;

/**
 * Seeds are idempotent upserts (spec §12) — running them twice must leave the
 * database in the same state, so `seed` is safe on a live dev box.
 *
 * Each seeds/*.php returns `function (Container $c): string` and reports what
 * it did.
 *
 * There are two sets, and the split is the whole point:
 *
 *   seeds/       ESSENTIAL. The roles and permissions that make the console
 *                reachable, the one staff account, the store's own settings,
 *                and the catalogue with the stock it is listed from. Everything
 *                here is either structure or product data — nothing that a
 *                person or an order would have created.
 *   seeds/demo/  The populated store: a shopper, their addresses, orders,
 *                payments, shipments, returns, reviews, support threads,
 *                vouchers and a year of trading figures. Useful for a
 *                screenshot or a test run, wrong for an install somebody is
 *                about to trade on.
 *
 * `preflight` runs the essential set only, so a fresh database comes up with an
 * empty ledger and a full catalogue.
 */
final class Seeder
{
    /** @var list<string> */
    private readonly array $directories;

    /**
     * @param string|list<string> $directories one or more directories, run in the order given
     */
    public function __construct(
        private readonly Container $container,
        string|array $directories,
    ) {
        $this->directories = array_values(is_string($directories) ? [$directories] : $directories);
    }

    /**
     * @param callable(string): void $report
     *
     * @return int number of seed files run
     */
    public function run(callable $report, ?string $only = null): int
    {
        $count = 0;

        foreach ($this->files() as $file) {
            $name = basename($file, '.php');

            if ($only !== null && $only !== $name && $only !== basename($file)) {
                continue;
            }

            /** @var mixed $seed */
            $seed = require $file;

            if (!is_callable($seed)) {
                throw new RuntimeException(sprintf('Seed %s must return a callable.', basename($file)));
            }

            /** @var mixed $summary */
            $summary = $seed($this->container);
            $report(sprintf('  + %s — %s', $name, is_string($summary) ? $summary : 'done'));
            ++$count;
        }

        return $count;
    }

    /**
     * Files in dependency order: sorted within a directory, and directories in
     * the order they were given. A demo seed can therefore count on every
     * essential seed having already run — which is what lets the shopper's
     * orders reference products that exist.
     *
     * @return list<string>
     */
    private function files(): array
    {
        $files = [];

        foreach ($this->directories as $directory) {
            $found = glob($directory . '/*.php');

            if ($found === false) {
                continue;
            }

            sort($found);
            $files = [...$files, ...$found];
        }

        return array_values($files);
    }
}
