<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Database;
use PDO;

/**
 * Writes the importable .sql files under database/.
 *
 * Migrations remain the source of truth — this exports what they produced, so
 * the dump can be regenerated after any schema change with
 * `php bin/console.php db:export` rather than edited by hand.
 *
 * Written in PHP rather than shelling out to mysqldump so it works on any
 * install (mysqldump is not always on PATH under XAMPP/WAMP).
 */
final class SchemaExporter
{
    /**
     * Reference data that is portable across installs: no secrets, no
     * per-install values. Password hashes are deliberately NOT exported — they
     * are peppered with this install's SESSION_SECRET and would not verify
     * anywhere else, so accounts come from `console.php seed` instead.
     *
     * @var list<string>
     */
    private const REFERENCE_TABLES = [
        // Carries the migration state with the dump, so `console.php migrate`
        // after an import reports "nothing to migrate" instead of trying to
        // re-create tables that are already there.
        'schema_migrations',
        'roles',
        'permissions',
        'role_permissions',
        'store_settings',
    ];

    public function __construct(
        private readonly Database $db,
        private readonly Config $config,
    ) {
    }

    /** @return array{schema: string, data: string, combined: string} paths written */
    public function export(string $directory): array
    {
        if (!is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        $database = $this->config->string('database.name', 'iced_out');
        $schema = $this->schemaSql($database);
        $data = $this->referenceDataSql();

        $schemaPath = $directory . '/iced_out_schema.sql';
        $dataPath = $directory . '/iced_out_reference_data.sql';
        $combinedPath = $directory . '/iced_out.sql';

        file_put_contents($schemaPath, $schema);
        file_put_contents($dataPath, $this->header('Reference data', $database) . $data);
        file_put_contents($combinedPath, $schema . PHP_EOL . $data);

        return ['schema' => $schemaPath, 'data' => $dataPath, 'combined' => $combinedPath];
    }

    private function schemaSql(string $database): string
    {
        $sql = $this->header('Schema', $database);

        $sql .= sprintf(
            "CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4;\nUSE `%s`;\n\n",
            $database,
            $database,
        );

        $sql .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

        /** @var list<string> $tables */
        $tables = [];
        /** @var list<string> $views */
        $views = [];

        foreach ($this->db->select('SHOW FULL TABLES') as $row) {
            $values = array_values($row);
            $name = (string) $values[0];

            if (($values[1] ?? 'BASE TABLE') === 'VIEW') {
                $views[] = $name;
            } else {
                $tables[] = $name;
            }
        }

        sort($tables);

        foreach ($tables as $table) {
            $sql .= sprintf("DROP TABLE IF EXISTS `%s`;\n%s;\n\n", $table, $this->createStatement($table, 'Create Table'));
        }

        foreach ($this->orderViews($views) as $view => $statement) {
            $sql .= sprintf("DROP VIEW IF EXISTS `%s`;\n%s;\n\n", $view, $this->stripDefiner($statement));
        }

        $sql .= "SET FOREIGN_KEY_CHECKS = 1;\n";

        return $sql;
    }

    private function referenceDataSql(): string
    {
        $sql = "-- Reference data: RBAC matrix and store settings.\n"
            . "-- Demo accounts are NOT here — run `php bin/console.php seed`.\n\n"
            . "SET FOREIGN_KEY_CHECKS = 0;\n\n";

        foreach (self::REFERENCE_TABLES as $table) {
            $rows = $this->db->select(sprintf('SELECT * FROM `%s`', $table));

            if ($rows === []) {
                continue;
            }

            $sql .= sprintf("-- %s (%d rows)\n", $table, count($rows));

            foreach ($rows as $row) {
                $columns = [];
                $values = [];

                foreach ($row as $column => $value) {
                    $columns[] = '`' . $column . '`';
                    $values[] = $this->literal($value);
                }

                $sql .= sprintf(
                    "INSERT INTO `%s` (%s) VALUES (%s);\n",
                    $table,
                    implode(', ', $columns),
                    implode(', ', $values),
                );
            }

            $sql .= "\n";
        }

        return $sql . "SET FOREIGN_KEY_CHECKS = 1;\n";
    }

    /**
     * A view built on another view (v_dashboard_queues reads
     * v_variant_availability) must be created after it, so alphabetical order
     * is not good enough. Emit any view whose definition names no
     * still-pending view, and repeat.
     *
     * @param list<string> $views
     *
     * @return array<string, string> view name => CREATE statement, in a safe order
     */
    private function orderViews(array $views): array
    {
        sort($views);

        $statements = [];

        foreach ($views as $view) {
            $statements[$view] = $this->createStatement($view, 'Create View');
        }

        /** @var array<string, string> $ordered */
        $ordered = [];
        $pending = $statements;

        while ($pending !== []) {
            $progressed = false;

            foreach ($pending as $view => $statement) {
                $blocked = false;

                foreach (array_keys($pending) as $other) {
                    if ($other !== $view && str_contains($statement, '`' . $other . '`')) {
                        $blocked = true;

                        break;
                    }
                }

                if (!$blocked) {
                    $ordered[$view] = $statement;
                    unset($pending[$view]);
                    $progressed = true;
                }
            }

            if (!$progressed) {
                // A cycle should be impossible in SQL views, but never loop forever.
                foreach ($pending as $view => $statement) {
                    $ordered[$view] = $statement;
                }

                break;
            }
        }

        return $ordered;
    }

    private function createStatement(string $name, string $key): string
    {
        $row = $this->db->selectOne(sprintf('SHOW CREATE TABLE `%s`', $name));

        if ($row === null) {
            return '';
        }

        foreach ($row as $column => $value) {
            if (strcasecmp((string) $column, $key) === 0) {
                return (string) $value;
            }
        }

        // MariaDB labels the view column "Create View"; MySQL matches on the
        // second column either way.
        $values = array_values($row);

        return isset($values[1]) ? (string) $values[1] : '';
    }

    /** A DEFINER clause names this machine's DB user and breaks the import elsewhere. */
    private function stripDefiner(string $statement): string
    {
        $cleaned = preg_replace('/DEFINER=`[^`]*`@`[^`]*`\s*/', '', $statement);
        $cleaned = preg_replace('/SQL SECURITY DEFINER\s*/', 'SQL SECURITY INVOKER ', (string) $cleaned);

        return (string) $cleaned;
    }

    private function literal(mixed $value): string
    {
        if ($value === null) {
            return 'NULL';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        return $this->db->pdo()->quote((string) $value, PDO::PARAM_STR);
    }

    private function header(string $what, string $database): string
    {
        return sprintf(
            "-- Iced_out — %s\n"
            . "-- Database: %s\n"
            . "-- Generated by `php bin/console.php db:export`. Do not edit by hand:\n"
            . "-- migrations/ is the source of truth, this file is its output.\n"
            . "-- Server: %s\n\n"
            . "SET NAMES utf8mb4;\nSET time_zone = '+00:00';\n\n",
            $what,
            $database,
            $this->db->pdo()->getAttribute(PDO::ATTR_SERVER_VERSION),
        );
    }
}
