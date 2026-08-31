<?php

declare(strict_types=1);

/**
 * CLI entry point (spec §2.2): migrate, seed, routes, key:generate, db:create.
 *
 *   php bin/console.php migrate [--fresh]
 *   php bin/console.php migrate:status
 *   php bin/console.php seed [name]
 *   php bin/console.php routes
 *   php bin/console.php key:generate
 *   php bin/console.php db:create
 */

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Route;
use Iced\Kernel\Router;
use Iced\Support\Config;
use Iced\Support\EndpointScaffolder;
use Iced\Support\Migrator;
use Iced\Support\SchemaExporter;
use Iced\Support\Seeder;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);

    exit;
}

$root = dirname(__DIR__);

require $root . '/autoload.php';

$app = Application::boot($root);
$container = $app->container;

/** @var list<string> $argvList */
$argvList = $argv ?? [];
$command = $argvList[1] ?? 'help';
$flags = array_slice($argvList, 2);

$out = static function (string $line = ''): void {
    fwrite(STDOUT, $line . PHP_EOL);
};

$fail = static function (string $line) use ($out): never {
    $out('  ! ' . $line);

    exit(1);
};

try {
    switch ($command) {
        case 'migrate':
            /** @var Database $db */
            $db = $container->get(Database::class);
            $migrator = new Migrator($db, $root . '/migrations');

            if (in_array('--fresh', $flags, true)) {
                $out('Dropping every table (--fresh)…');
                $migrator->dropAll();
            }

            $out(sprintf('Migrating against %s…', $db->flavour()));
            $applied = $migrator->migrate($out);
            $out($applied === 0 ? 'Nothing to migrate — schema is current.' : sprintf('Applied %d migration(s).', $applied));

            break;

        case 'migrate:status':
            /** @var Database $db */
            $db = $container->get(Database::class);
            $migrator = new Migrator($db, $root . '/migrations');

            foreach ($migrator->status() as $row) {
                $out(sprintf('  %-10s %-40s %s', $row['status'], $row['filename'], $row['checksum']));
            }

            break;

        /**
         * The essential set by default — roles, permissions, the staff account,
         * store settings and the catalogue. `--demo` adds the populated store on
         * top (a shopper with orders, shipments, returns, reviews and a year of
         * trading figures), which is fixture data and never what an install
         * somebody is about to trade on should start with.
         */
        case 'seed':
            $withDemo = in_array('--demo', $flags, true);
            $directories = $withDemo
                ? [$root . '/seeds', $root . '/seeds/demo']
                : [$root . '/seeds'];

            $seeder = new Seeder($container, $directories);
            $only = null;

            foreach ($flags as $flag) {
                if (!str_starts_with($flag, '--')) {
                    $only = $flag;

                    break;
                }
            }

            /* A named seed is looked for in both sets, so `seed 0011_dashboard`
               works without having to remember which directory it lives in. */
            if ($only !== null && !$withDemo) {
                $seeder = new Seeder($container, [$root . '/seeds', $root . '/seeds/demo']);
            }

            $out($withDemo ? 'Seeding (essential + demo)…' : 'Seeding…');
            $ran = $seeder->run($out, $only);
            $out(sprintf('Ran %d seed file(s).', $ran));

            if ($ran === 0 && $only !== null) {
                $out(sprintf('  ! no seed named "%s" in seeds/ or seeds/demo/.', $only));
            }

            break;

        case 'routes':
            /** @var Router $router */
            $router = $container->get(Router::class);
            $routes = $router->all();

            usort($routes, static fn (Route $a, Route $b): int => [$a->path, $a->method] <=> [$b->path, $b->method]);

            $out(sprintf('  %-7s %-46s %-9s %-26s %s', 'METHOD', 'PATH', 'AUD', 'PERMISSION', 'NAME'));

            foreach ($routes as $route) {
                $out(sprintf(
                    '  %-7s %-46s %-9s %-26s %s%s',
                    $route->method,
                    $route->path,
                    $route->audience,
                    $route->permission ?? '—',
                    $route->name ?? '',
                    $route->idempotent ? '  [idem]' : '',
                ));
            }

            $out(sprintf('%d route(s).', count($routes)));

            break;

        case 'key:generate':
            $out('SESSION_SECRET=' . bin2hex(random_bytes(32)));
            $out('Copy that line into backend/.env (it signs session and tracking tokens).');

            break;

        case 'db:create':
            /** @var Database $db */
            $db = $container->get(Database::class);
            /** @var Config $config */
            $config = $container->get(Config::class);
            $name = $config->string('database.name', 'iced_out');

            if (preg_match('/^[A-Za-z0-9_]+$/', $name) !== 1) {
                $fail(sprintf('Refusing to create database "%s" — name must be alphanumeric/underscore.', $name));
            }

            $server = $db->serverPdo();
            $collation = stripos((string) $server->getAttribute(PDO::ATTR_SERVER_VERSION), 'mariadb') !== false
                ? 'utf8mb4_unicode_ci'
                : 'utf8mb4_0900_ai_ci';

            $server->exec(sprintf(
                'CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4 COLLATE %s',
                $name,
                $collation,
            ));
            $out(sprintf('Database `%s` ready (%s).', $name, $collation));

            break;

        case 'db:export':
            /** @var Database $db */
            $db = $container->get(Database::class);
            /** @var Config $config */
            $config = $container->get(Config::class);

            $exporter = new SchemaExporter($db, $config);
            $written = $exporter->export($root . '/database');

            foreach ($written as $label => $path) {
                $out(sprintf('  + %-9s %s', $label, basename($path)));
            }

            $out('Import database/iced_out.sql through phpMyAdmin for a one-shot setup.');

            break;

        /**
         * Everything the server needs before it can answer a request, checked
         * and fixed in one go. Written as a command rather than as batch script
         * logic so it behaves the same however the server is started.
         */
        case 'preflight':
            /** @var Config $config */
            $config = $container->get(Config::class);

            // 1. A signing secret. Sessions and tracking tokens are HMACed with
            //    it, so a blank one means every session is forgeable.
            if ($config->string('app.session.secret') === '') {
                $envFile = $root . '/.env';

                if (!is_file($envFile)) {
                    $fail('.env is missing — copy .env.example to .env first.');
                }

                $contents = (string) file_get_contents($envFile);
                $secret = bin2hex(random_bytes(32));

                $contents = preg_match('/^SESSION_SECRET=.*$/m', $contents) === 1
                    ? (string) preg_replace('/^SESSION_SECRET=.*$/m', 'SESSION_SECRET=' . $secret, $contents)
                    : rtrim($contents) . PHP_EOL . 'SESSION_SECRET=' . $secret . PHP_EOL;

                file_put_contents($envFile, $contents);
                $out('  + minted a SESSION_SECRET');
            }

            // 2. A database server. This is the failure people actually hit, so
            //    it is named rather than left as a PDO stack trace.
            /** @var Database $db */
            $db = $container->get(Database::class);

            try {
                $server = $db->serverPdo();
            } catch (Throwable) {
                $out('');
                $out('  MySQL is not reachable on ' . $config->string('database.host', '127.0.0.1')
                    . ':' . $config->int('database.port', 3306) . '.');
                $out('  Open the XAMPP Control Panel and press Start next to MySQL, then run this again.');
                $out('');

                exit(1);
            }

            $name = $config->string('database.name', 'iced_out');

            if (preg_match('/^[A-Za-z0-9_]+$/', $name) !== 1) {
                $fail(sprintf('Refusing to create database "%s" — name must be alphanumeric/underscore.', $name));
            }

            $collation = stripos((string) $server->getAttribute(PDO::ATTR_SERVER_VERSION), 'mariadb') !== false
                ? 'utf8mb4_unicode_ci'
                : 'utf8mb4_0900_ai_ci';

            $server->exec(sprintf(
                'CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4 COLLATE %s',
                $name,
                $collation,
            ));

            // 3. The schema. Migrations are forward-only and checksummed, so
            //    running them on every start is a no-op once they are applied.
            $applied = (new Migrator($db, $root . '/migrations'))->migrate($out);

            if ($applied > 0) {
                $out(sprintf('  + applied %d migration(s)', $applied));
            }

            /**
             * 4. Seed data — the ESSENTIAL set only.
             *
             * Every essential register is checked, not just one. A single
             * sentinel table cannot tell a fresh install from a HALF-seeded one,
             * and a half-seeded store never heals: `users` had rows, so seeding
             * was skipped forever while `products` stayed empty and the console
             * showed nothing.
             *
             * These are the registers an install cannot function without: the
             * permission table the console authorises against, the staff account
             * that can sign in, the store's settings, and the catalogue with the
             * stock behind it. Deliberately NOT here are orders, customers and
             * trading figures — those are empty on a real install and stay empty
             * until somebody registers and buys something. Listing `orders` here
             * is what used to re-seed a demo shopper's purchase history onto
             * every boot of a clean database.
             *
             * Re-running is safe — the seeds are idempotent upserts — but it is
             * still gated, because unconditionally re-seeding would resurrect
             * records an operator had deliberately removed.
             */
            $core = ['roles', 'permissions', 'users', 'store_settings', 'warehouses', 'stock_items', 'products'];
            $missing = [];

            foreach ($core as $table) {
                $count = $db->selectOne(sprintf('SELECT COUNT(*) AS n FROM %s', $table));

                if ($count === null || (int) $count['n'] === 0) {
                    $missing[] = $table;
                }
            }

            if ($missing !== []) {
                $out(sprintf('  + %s empty — seeding', implode(', ', $missing)));
                (new Seeder($container, $root . '/seeds'))->run($out);
            }

            $out('Ready.');

            break;

        /**
         * Is every endpoint actually wired? Checks each route's handler class
         * and method really exist, that names are unique, that no two routes
         * claim the same method+path, and that every route has a file under
         * api/ to be found at.
         */
        case 'routes:check':
            /** @var Router $router */
            $router = $container->get(Router::class);
            $scaffolder = new EndpointScaffolder($router, $root . '/api');

            $problems = 0;
            $names = [];
            $signatures = [];

            foreach ($router->all() as $route) {
                $label = sprintf('%s %s', $route->method, $route->path);

                [$class, $method] = array_pad($route->handler, 2, null);

                if (!is_string($class) || !class_exists($class)) {
                    $out(sprintf('  ! %-46s handler class %s does not exist', $label, (string) $class));
                    ++$problems;

                    continue;
                }

                if (!is_string($method) || !method_exists($class, $method)) {
                    $out(sprintf('  ! %-46s %s::%s does not exist', $label, $class, (string) $method));
                    ++$problems;

                    continue;
                }

                if ($route->name === null) {
                    $out(sprintf('  ! %-46s has no name', $label));
                    ++$problems;

                    continue;
                }

                if (isset($names[$route->name])) {
                    $out(sprintf('  ! %-46s name "%s" is already used', $label, $route->name));
                    ++$problems;
                }

                $names[$route->name] = true;

                if (isset($signatures[$label])) {
                    $out(sprintf('  ! %-46s is declared twice', $label));
                    ++$problems;
                }

                $signatures[$label] = true;

                if ($route->audience === Route::AUDIENCE_STAFF && $route->permission === null
                    && !str_starts_with($route->path, '/admin/auth')
                    && !str_starts_with($route->path, '/admin/me')) {
                    $out(sprintf('  ? %-46s is staff-only but names no permission', $label));
                }

                $file = $root . '/api/' . $scaffolder->fileFor($route) . '.php';

                if (!is_file($file)) {
                    $out(sprintf('  ! %-46s has no file (run make:endpoints)', $label));
                    ++$problems;
                }
            }

            $out('');
            $out(sprintf(
                '%d route(s) checked — %s',
                count($router->all()),
                $problems === 0 ? 'all wired' : sprintf('%d problem(s)', $problems),
            ));

            if ($problems > 0) {
                exit(1);
            }

            break;

        case 'make:endpoints':
            /** @var Router $router */
            $router = $container->get(Router::class);
            $scaffolder = new EndpointScaffolder($router, $root . '/api');
            $result = $scaffolder->scaffold($out);
            $out(sprintf('%d endpoint file(s) written, %d already present.', $result['written'], $result['skipped']));

            break;

        case 'help':
        default:
            $out('Iced_out backend console');
            $out('');
            $out('  migrate [--fresh]     apply pending migrations (--fresh drops everything first)');
            $out('  migrate:status        show applied / pending / changed migrations');
            $out('  seed [name]           run the essential seeds — admin access, settings, catalogue');
            $out('  seed --demo           …and the demo store on top (shopper, orders, shipments, figures)');
            $out('  routes                print the route table');
            $out('  key:generate          mint a SESSION_SECRET');
            $out('  db:create             create the configured database');
            $out('  db:export             write database/*.sql for phpMyAdmin import');
            $out('  make:endpoints        generate the api/ file tree from the route table');
            $out('  routes:check          verify every route has a real handler, name and file');
            $out('  preflight             mint a secret, create + migrate the database, seed if empty');

            break;
    }
} catch (Throwable $error) {
    $fail($error->getMessage());
}
