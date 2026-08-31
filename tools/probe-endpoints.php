<?php

declare(strict_types=1);

/**
 * Hits every GET route on a backend, in process, against the real database.
 *
 * This is the check that actually proves the SQL matches the schema: a column
 * that does not exist is a PDOException, which the kernel turns into
 * ICE-SYS-500. Nothing else finds those — a typecheck cannot see inside a SQL
 * string, and a contract audit only proves the route exists.
 *
 *   php probe.php <backendRoot> <audience> [email] [password]
 */

$root = $argv[1];
$audience = $argv[2] ?? 'admin';
$email = $argv[3] ?? null;
$password = $argv[4] ?? null;

require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Router;
use Iced\Support\Json;

$app = Application::boot($root);
$db = $app->container->make(Database::class);
$router = $app->container->make(Router::class);
$cookies = [];

$appUrl = $app->config()->string('app.url', 'http://127.0.0.1');
$parts = parse_url($appUrl);
$GLOBALS['probeOrigin'] = ($parts['scheme'] ?? 'http') . '://' . ($parts['host'] ?? '127.0.0.1')
    . (isset($parts['port']) ? ':' . $parts['port'] : '');

function absorb(Response $r, array &$cookies): void
{
    $header = $r->headers()['Set-Cookie'] ?? null;
    if (!is_string($header) || preg_match('/^([^=]+)=([^;]*)/', $header, $m) !== 1) {
        return;
    }
    $name = trim($m[1]);
    if (trim($m[2]) === '' || str_contains($header, 'Max-Age=0')) {
        unset($cookies[$name]);
        return;
    }
    $cookies[$name] = trim($m[2]);
}

function call(string $method, string $path, array $query = [], ?array $body = null): array
{
    global $app, $cookies, $audience;

    /* The app's own URL is always a trusted origin (see OriginCheck), so every
       mutation this probe makes passes the CSRF guard the way a real request
       from the site would. */
    $headers = ['x-client-audience' => $audience, 'origin' => $GLOBALS['probeOrigin']];
    $raw = '';
    if ($body !== null) {
        $headers['content-type'] = 'application/json';
        $raw = Json::encode($body);
    }

    $res = $app->handle(new Request(
        method: $method, path: $path, query: $query, headers: $headers,
        cookies: $cookies, rawBody: $raw, ip: '127.0.0.1',
    ));
    absorb($res, $cookies);

    return [$res->status(), $res->body()];
}

/* ---------------------------------------------------------------- sign in */
/**
 * The customer half is probed as a THROWAWAY account this script creates and
 * deletes, rather than as a seeded one.
 *
 * Without a session, thirteen `/me/**` routes answer 401 before their handler
 * runs — so their SQL never executes and the probe proves nothing about them.
 * Those are exactly the queries most likely to name a column that has moved.
 *
 * A fresh account also keeps the probe honest: it reads an empty archive, an
 * empty wallet and an empty address book, which is the shape a real first
 * sign-in produces and the one an off-by-one in a presenter falls over on.
 */
$throwaway = null;

if ($audience === 'customer' && $email === null) {
    $email = 'audit-probe-' . bin2hex(random_bytes(4)) . '@example.invalid';
    $password = 'audit-probe-' . bin2hex(random_bytes(6));

    [$status] = call('POST', '/auth/register', [], [
        'name' => 'Audit Probe',
        'email' => $email,
        'password' => $password,
    ]);

    if ($status !== 201) {
        fwrite(STDERR, sprintf("could not create the probe account (%d)\n", $status));
        exit(1);
    }

    $throwaway = $email;

    /* Registering ALREADY signed this account in — the response carried the
       cookie and `call()` absorbed it. Logging in again would be a second
       cookie-authenticated mutation, which OriginCheck refuses (403) unless the
       origin is one of the app's trusted ones. Nothing to gain, so skip it. */
    $email = null;
}

/** Removes the throwaway account whichever way this script ends. */
$cleanup = static function () use (&$throwaway, $db): void {
    if ($throwaway === null) {
        return;
    }

    $row = $db->selectOne('SELECT id FROM users WHERE email = ?', [$throwaway]);
    $throwaway = null;

    if ($row === null) {
        return;
    }

    $id = (int) $row['id'];
    $db->statement('DELETE FROM user_sessions WHERE user_id = ?', [$id]);
    $db->statement('DELETE FROM user_addresses WHERE user_id = ?', [$id]);
    $db->statement('DELETE FROM users WHERE id = ?', [$id]);
};

register_shutdown_function($cleanup);

if ($email !== null) {
    [$status] = call('POST', $audience === 'admin' ? '/admin/auth/login' : '/auth/login',
        [], ['email' => $email, 'password' => $password]);
    if ($status !== 200) {
        fwrite(STDERR, "sign-in failed ($status) — cannot probe authenticated routes\n");
        exit(1);
    }
}

/* ------------------------------------------------- real ids for {params} */
$one = static function (string $sql) use ($db): ?string {
    try {
        $row = $db->selectOne($sql);
        return $row === null ? null : (string) array_values($row)[0];
    } catch (Throwable) {
        return null;
    }
};

$SAMPLES = [
    'id' => $one('SELECT public_id FROM media_assets WHERE deleted_at IS NULL LIMIT 1'),
    'number' => $one('SELECT number FROM orders LIMIT 1'),
    'slug' => $one('SELECT slug FROM products WHERE deleted_at IS NULL LIMIT 1'),
    'sku' => $one('SELECT sku FROM product_variants LIMIT 1'),
    'code' => $one('SELECT code FROM vouchers LIMIT 1'),
    'reference' => $one('SELECT public_id FROM support_queries LIMIT 1'),
    'lead' => $one('SELECT public_id FROM crm_leads WHERE deleted_at IS NULL LIMIT 1'),
    'contact' => $one('SELECT public_id FROM crm_contacts WHERE deleted_at IS NULL LIMIT 1'),
    'company' => $one('SELECT public_id FROM crm_companies WHERE deleted_at IS NULL LIMIT 1'),
    'deal' => $one('SELECT public_id FROM crm_deals WHERE deleted_at IS NULL LIMIT 1'),
    'activity' => $one('SELECT public_id FROM crm_activities WHERE deleted_at IS NULL LIMIT 1'),
    'note' => $one('SELECT public_id FROM crm_notes WHERE deleted_at IS NULL LIMIT 1'),
    'slide' => $one('SELECT public_id FROM home_hero_slides WHERE deleted_at IS NULL LIMIT 1'),
    'token' => $one('SELECT tracking_token FROM shipments LIMIT 1'),
];

/* Anything the samples above could not fill gets a plausible-looking id, so the
   route is still exercised — a 404 from a real handler still proves its SQL
   parsed and ran. */
$FALLBACK = 'probe-nonexistent-1';

/* Query strings some list endpoints need to take their interesting branch. */
$QUERIES = [
    '/admin/dashboard/trading' => ['days' => '30'],
    '/admin/analytics/overview' => ['days' => '30'],
    '/admin/analytics/breakdowns' => ['days' => '30'],
    '/admin/crm/activities' => ['scope' => 'overdue'],
    '/admin/crm/notes' => ['about' => 'contact', 'aboutId' => $SAMPLES['contact'] ?? $FALLBACK],
    '/admin/support/queries' => ['status' => 'all'],
];

$pass = 0;
$fail = 0;
$skipped = 0;

foreach ($router->all() as $route) {
    if ($route->method !== 'GET') {
        continue;
    }

    $path = $route->path;
    $filled = preg_replace_callback('/\{(\w+)\}/', static function (array $m) use ($SAMPLES, $FALLBACK): string {
        return $SAMPLES[$m[1]] ?? $FALLBACK;
    }, $path);

    $query = $QUERIES[$path] ?? [];

    [$status, $body] = call('GET', $filled, $query);

    /* 2xx is working. 404 is a real handler saying the id is not there — its SQL
       ran. 401/403 mean the guard fired before the handler, which is also not a
       schema problem. 500 is the one that matters. */
    if ($status >= 500) {
        ++$fail;
        $decoded = Json::decodeArray($body) ?? [];
        $message = $decoded['error']['message'] ?? substr($body, 0, 160);
        printf("  FAIL %3d  %-52s %s\n", $status, $path, $message);
    } elseif ($status === 401 || $status === 403) {
        ++$skipped;
        printf("  gate %3d  %s\n", $status, $path);
    } else {
        ++$pass;
    }
}

printf("\n  %d ok, %d gated, %d SERVER ERRORS\n", $pass, $skipped, $fail);
exit($fail === 0 ? 0 : 1);
