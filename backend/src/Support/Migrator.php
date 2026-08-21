<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Database;
use PDOException;
use RuntimeException;

/**
 * Checksummed forward-only migrations (spec §2.2). Each file is recorded in
 * schema_migrations with a SHA-256 of its contents, so an already-applied file
 * that later changes is reported rather than silently skipped.
 *
 * `{{collation}}` in a migration is resolved per server: MySQL 8 gets
 * utf8mb4_0900_ai_ci (the spec's choice); MariaDB — which has no such
 * collation — gets utf8mb4_unicode_ci.
 */
final class Migrator
{
    public function __construct(
        private readonly Database $db,
        private readonly string $directory,
    ) {
    }

    public function ensureRegistry(): void
    {
        $this->db->statement(
            'CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                filename VARCHAR(191) NOT NULL,
                checksum CHAR(64) NOT NULL,
                statements INT UNSIGNED NOT NULL DEFAULT 0,
                applied_at DATETIME(6) NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uq_schema_migrations_filename (filename)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        );
    }

    /** @return list<array{filename: string, status: string, checksum: string}> */
    public function status(): array
    {
        $this->ensureRegistry();

        $applied = [];

        foreach ($this->db->select('SELECT filename, checksum FROM schema_migrations') as $row) {
            $applied[(string) $row['filename']] = (string) $row['checksum'];
        }

        $report = [];

        foreach ($this->files() as $file) {
            $name = basename($file);
            $checksum = hash('sha256', (string) file_get_contents($file));

            if (!isset($applied[$name])) {
                $status = 'pending';
            } elseif ($applied[$name] !== $checksum) {
                $status = 'changed';
            } else {
                $status = 'applied';
            }

            $report[] = ['filename' => $name, 'status' => $status, 'checksum' => substr($checksum, 0, 12)];
        }

        return $report;
    }

    /**
     * @param callable(string): void $report
     *
     * @return int number of files applied
     */
    public function migrate(callable $report): int
    {
        $this->ensureRegistry();

        $applied = [];

        foreach ($this->db->select('SELECT filename, checksum FROM schema_migrations') as $row) {
            $applied[(string) $row['filename']] = (string) $row['checksum'];
        }

        $collation = $this->db->flavour() === 'mariadb' ? 'utf8mb4_unicode_ci' : 'utf8mb4_0900_ai_ci';
        $count = 0;

        foreach ($this->files() as $file) {
            $name = basename($file);
            $sql = (string) file_get_contents($file);
            $checksum = hash('sha256', $sql);

            if (isset($applied[$name])) {
                if ($applied[$name] !== $checksum) {
                    $report(sprintf('  ! %s has changed since it was applied — write a new migration instead.', $name));
                }

                continue;
            }

            $statements = self::split(str_replace('{{collation}}', $collation, $sql));

            foreach ($statements as $index => $statement) {
                try {
                    $this->db->pdo()->exec($statement);
                } catch (PDOException $error) {
                    throw new RuntimeException(sprintf(
                        "Migration %s failed at statement %d:\n%s\n\n%s",
                        $name,
                        $index + 1,
                        mb_substr($statement, 0, 400),
                        $error->getMessage(),
                    ), 0, $error);
                }
            }

            $this->db->statement(
                'INSERT INTO schema_migrations (filename, checksum, statements, applied_at) VALUES (?, ?, ?, UTC_TIMESTAMP(6))',
                [$name, $checksum, count($statements)],
            );

            $report(sprintf('  + %s (%d statements)', $name, count($statements)));
            ++$count;
        }

        return $count;
    }

    /** Drops every table in the schema — dev only, used by `migrate --fresh`. */
    public function dropAll(): void
    {
        $pdo = $this->db->pdo();
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

        foreach ($this->db->select('SHOW FULL TABLES') as $row) {
            $values = array_values($row);
            $name = (string) $values[0];
            $type = isset($values[1]) ? (string) $values[1] : 'BASE TABLE';

            $pdo->exec($type === 'VIEW' ? 'DROP VIEW IF EXISTS `' . $name . '`' : 'DROP TABLE IF EXISTS `' . $name . '`');
        }

        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    /** @return list<string> */
    private function files(): array
    {
        $found = glob($this->directory . '/*.sql');

        if ($found === false) {
            return [];
        }

        sort($found);

        return array_values($found);
    }

    /**
     * Splits a migration into statements on top-level semicolons, ignoring the
     * ones inside quoted literals and `--` comments.
     *
     * @return list<string>
     */
    public static function split(string $sql): array
    {
        /** @var list<string> $statements */
        $statements = [];
        $buffer = '';
        $length = strlen($sql);
        $quote = null;
        $inLineComment = false;

        for ($i = 0; $i < $length; ++$i) {
            $char = $sql[$i];
            $next = $i + 1 < $length ? $sql[$i + 1] : '';

            if ($inLineComment) {
                if ($char === "\n") {
                    $inLineComment = false;
                    $buffer .= $char;
                }

                continue;
            }

            if ($quote === null && $char === '-' && $next === '-') {
                $inLineComment = true;
                ++$i;

                continue;
            }

            if ($quote !== null) {
                $buffer .= $char;

                if ($char === '\\') {
                    if ($next !== '') {
                        $buffer .= $next;
                        ++$i;
                    }

                    continue;
                }

                if ($char === $quote) {
                    $quote = null;
                }

                continue;
            }

            if ($char === "'" || $char === '"' || $char === '`') {
                $quote = $char;
                $buffer .= $char;

                continue;
            }

            if ($char === ';') {
                $trimmed = trim($buffer);

                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }

                $buffer = '';

                continue;
            }

            $buffer .= $char;
        }

        $tail = trim($buffer);

        if ($tail !== '') {
            $statements[] = $tail;
        }

        return $statements;
    }
}
