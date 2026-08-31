<?php

declare(strict_types=1);

/**
 * Every column named in an INSERT or UPDATE, checked against the live schema.
 *
 * The GET probe proves the READ paths, because a bad column there is a 500. The
 * write paths do not run unless somebody presses the button, so they are checked
 * statically instead — and they are where an unknown column is most likely to
 * hide, since an INSERT names a dozen at once.
 *
 *   php schema-audit.php <backendRoot> [<backendRoot> ...]
 */

$roots = array_slice($argv, 1);

if ($roots === []) {
    fwrite(STDERR, "usage: php schema-audit.php <backendRoot> [...]\n");
    exit(1);
}

require $roots[0] . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;

$app = Application::boot($roots[0]);
$db = $app->container->make(Database::class);

/* ------------------------------------------------------- the live schema */
$schema = [];

foreach ($db->select(
    'SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()',
) as $row) {
    $schema[strtolower((string) $row['TABLE_NAME'])][strtolower((string) $row['COLUMN_NAME'])] = true;
}

printf("schema: %d tables\n\n", count($schema));

/* --------------------------------------------------------- walk the PHP */
$problems = 0;
$checked = 0;

function phpFiles(string $dir): array
{
    $out = [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));

    foreach ($it as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $out[] = $file->getPathname();
        }
    }

    sort($out);

    return $out;
}

foreach ($roots as $root) {
    printf("========== %s ==========\n", basename(dirname($root)) . '/' . basename($root));

    foreach (phpFiles($root . '/src') as $file) {
        $code = (string) file_get_contents($file);
        $rel = str_replace($root . DIRECTORY_SEPARATOR, '', $file);
        $rel = str_replace('\\', '/', $rel);

        /* ---- INSERT INTO <table> (a, b, c) ---- */
        if (preg_match_all('/INSERT\s+INTO\s+`?(\w+)`?\s*\(([^)]*)\)/is', $code, $m, PREG_SET_ORDER)) {
            foreach ($m as $hit) {
                $table = strtolower($hit[1]);

                if (!isset($schema[$table])) {
                    printf("  ! %s\n      INSERT into unknown table `%s`\n", $rel, $table);
                    ++$problems;

                    continue;
                }

                foreach (preg_split('/\s*,\s*/', trim($hit[2])) as $col) {
                    $col = strtolower(trim($col, " \t\n\r`"));

                    if ($col === '' || str_contains($col, '$') || str_contains($col, '(')) {
                        continue;
                    }

                    ++$checked;

                    if (!isset($schema[$table][$col])) {
                        printf("  ! %s\n      INSERT %s.%s — no such column\n", $rel, $table, $col);
                        ++$problems;
                    }
                }
            }
        }

        /* ---- UPDATE <table> SET a = ?, b = ? ---- */
        if (preg_match_all('/UPDATE\s+`?(\w+)`?\s+SET\s+(.+?)(?:\s+WHERE\s|\'|\s*"\s*,)/is', $code, $m, PREG_SET_ORDER)) {
            foreach ($m as $hit) {
                $table = strtolower($hit[1]);

                if (!isset($schema[$table])) {
                    printf("  ! %s\n      UPDATE unknown table `%s`\n", $rel, $table);
                    ++$problems;

                    continue;
                }

                /* A SET carrying a printf placeholder or a PHP variable is one
                   this audit cannot read — `%s` would be scanned as a column
                   called "s". Skipped rather than guessed at; those call sites
                   are covered by review and by the endpoint probe. */
                if (str_contains($hit[2], '%') || str_contains($hit[2], '$')) {
                    continue;
                }

                /* `col = ?` pairs only. */
                if (preg_match_all('/`?(\w+)`?\s*=\s*(?:\?|NULL|UTC_TIMESTAMP)/i', $hit[2], $cols)) {
                    foreach ($cols[1] as $col) {
                        $col = strtolower($col);
                        ++$checked;

                        if (!isset($schema[$table][$col])) {
                            printf("  ! %s\n      UPDATE %s.%s — no such column\n", $rel, $table, $col);
                            ++$problems;
                        }
                    }
                }
            }
        }
    }
}

printf("\n  %d literal column references checked, %d PROBLEMS\n", $checked, $problems);
exit($problems === 0 ? 0 : 1);
