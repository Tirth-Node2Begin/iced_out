<?php

declare(strict_types=1);

/**
 * The route table says what it means.
 *
 *   php tests/Smoke/route-config-smoke.php
 *
 * ── WHY A TEST FOR CONFIGURATION ────────────────────────────────────────────
 *
 * Three separate defects in this codebase were the same defect: a route whose
 * declared protection was silently discarded by PHP's own array semantics, in a
 * file where the discarded line sat in plain sight looking correct.
 *
 *   1. `'rate_limit' => 'uploads'` immediately above `'rate_limit' => 'console_write'`
 *      in one literal. A duplicate key is not an error and does not warn — the
 *      last one wins — so media upload ran at 60/minute instead of 10/hour.
 *
 *   2. `$read(...) + ['rate_limit' => 'exports']` on the payments export. The
 *      array union operator keeps the LEFT operand on a collision, so the
 *      builder's `console_read` won and the export ran at 300/minute instead of
 *      5/hour. The method's own docblock said "rate-limited 5/hour".
 *
 *   3. `/me/password` with no bucket at all, in a file where every neighbouring
 *      route has one.
 *
 * None of these is visible in review, because in each case the correct
 * intention is written down right there. They are only visible in the LOADED
 * table, which is what this file inspects. A reviewer cannot be expected to hold
 * PHP's array-union precedence in their head at the bottom of a 200-line route
 * file; a test can.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
 *
 * It does not assert a bucket for every route. Plenty of routes legitimately
 * have none, and a test that demanded one everywhere would be answered by
 * sprinkling `default` around, which protects nothing and would make this file
 * worse than useless. It names the routes where a specific limit is the control,
 * and checks the structure everywhere.
 *
 * Reads configuration only. Touches no database.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Support\Config;

$app = Application::boot($root);
/** @var Config $config */
$config = $app->container->get(Config::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-56s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

/**
 * Duplicate keys in an array literal, found by reading the SOURCE.
 *
 * It has to be the source: by the time PHP has built the array the loser is
 * gone without a trace, which is the entire problem. Tokenising is the only way
 * to see a key that was written and then silently dropped.
 *
 * @return list<string>
 */
function duplicateKeys(string $file): array
{
    $tokens = token_get_all((string) file_get_contents($file));
    $count = count($tokens);
    $depth = 0;
    $seen = [];
    $found = [];

    foreach ($tokens as $i => $token) {
        if ($token === '[') {
            ++$depth;
            $seen[$depth] = [];

            continue;
        }

        if ($token === ']') {
            unset($seen[$depth]);
            --$depth;

            continue;
        }

        if (!is_array($token) || $token[0] !== T_CONSTANT_ENCAPSED_STRING) {
            continue;
        }

        // A string is only a KEY if the next meaningful token is `=>`.
        for ($j = $i + 1; $j < $count; ++$j) {
            $next = $tokens[$j];

            if (is_array($next) && in_array($next[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }

            if (is_array($next) && $next[0] === T_DOUBLE_ARROW) {
                $key = trim($token[1], "'\"");

                if (isset($seen[$depth][$key])) {
                    $found[] = sprintf('%s:%d duplicate "%s" (first at line %d)', basename($file), $token[2], $key, $seen[$depth][$key]);
                } else {
                    $seen[$depth][$key] = $token[2];
                }
            }

            break;
        }
    }

    return $found;
}

/** @return array<string, array<string, mixed>> */
function loadRoutes(string $dir): array
{
    $byName = [];

    foreach (glob($dir . '/*.php') ?: [] as $file) {
        foreach ((array) require $file as $route) {
            if (is_array($route) && isset($route['name'])) {
                $byName[(string) $route['name']] = $route;
            }
        }
    }

    return $byName;
}

echo "\n\033[1mNo silently discarded keys\033[0m\n\n";

$duplicates = [];

foreach (glob($root . '/config/routes/*.php') ?: [] as $file) {
    $duplicates = [...$duplicates, ...duplicateKeys($file)];
}

ok('no duplicate key in any route literal', $duplicates === [], $duplicates === [] ? '' : implode('; ', $duplicates));

$routes = loadRoutes($root . '/config/routes');
$buckets = (array) $config->get('app.rate_limits', []);

echo "\n\033[1mEvery bucket a route names actually exists\033[0m\n\n";

/* A typo here fails OPEN in the worst way: RateLimit cannot find the bucket, and
   a route that looks limited is not. Cheap to check, and it is the failure mode
   a rename would produce. */
$unknown = [];

foreach ($routes as $name => $route) {
    $bucket = $route['rate_limit'] ?? null;

    if (is_string($bucket) && !isset($buckets[$bucket])) {
        $unknown[] = sprintf('%s → "%s"', $name, $bucket);
    }
}

ok('no route names a bucket that is not defined', $unknown === [], $unknown === [] ? count($routes) . ' routes' : implode('; ', $unknown));

echo "\n\033[1mThe routes where the limit IS the control\033[0m\n\n";

/* Named one by one, with the reason each is on the list. Anything that verifies
   a credential, spends money, reserves stock, or writes a file belongs here. */
$required = [
    'auth.login' => ['auth', 'guessing a password'],
    'auth.register' => ['auth', 'minting accounts'],
    'auth.password.forgot' => ['password_forgot', 'mailbombing an address'],
    'auth.password.verify' => ['password_otp', 'guessing a six-digit code'],
    'auth.password.reset' => ['password_otp', 'guessing a six-digit code'],
    'me.password' => ['password_change', 'guessing the CURRENT password with a stolen cookie'],
    'me.photo.upload' => ['uploads', 'filling the disk'],
    'me.wallet.redeem' => ['payments', 'spending balance'],
];

foreach ($required as $name => [$bucket, $why]) {
    $actual = $routes[$name]['rate_limit'] ?? '(none)';
    ok(sprintf('%-28s %s', $name, $why), $actual === $bucket, $actual === $bucket ? $bucket : "expected $bucket, got $actual");
}

echo "\n\033[1mAnd the audiences those routes are on\033[0m\n\n";

/* `me.*` is the customer's own data. A `public` audience on any of them would
   hand it to anybody, and the audience header is also this API's primary CSRF
   defence — so a wrong value here is two holes, not one. */
$leaked = [];

foreach ($routes as $name => $route) {
    if (str_starts_with($name, 'me.') && ($route['audience'] ?? '') !== 'customer') {
        $leaked[] = $name . ' → ' . (string) ($route['audience'] ?? '(none)');
    }
}

ok('every me.* route is customer-audience', $leaked === [], $leaked === [] ? '' : implode('; ', $leaked));

printf("\n  %d passed, %d failed\n\n", $pass, $fail);

exit($fail === 0 ? 0 : 1);
