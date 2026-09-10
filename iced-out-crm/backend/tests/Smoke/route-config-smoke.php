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
 *   3. The storefront's `/me/password` with no bucket at all, in a file where
 *      every neighbouring route has one. Its twin of this file covers that.
 *
 * The first two were HERE, which is why this side also checks the console's
 * audiences and its `step_up` flags: the same silent-discard failure applies to
 * every key in these literals, and those two decide whether a borrowed staff
 * session can send money.
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
    'admin.auth.login' => ['auth', 'guessing a staff password'],
    'admin.auth.mfa.verify' => ['auth', 'guessing a six-digit code'],
    'admin.auth.mfa.begin' => ['auth', 'enrolling a second factor'],
    'admin.auth.mfa.confirm' => ['auth', 'enrolling a second factor'],
    'admin.auth.mfa.disable' => ['auth', 'REMOVING a second factor'],
    // Both of the bugs this file exists for. Named individually so a
    // reintroduction fails here by name rather than as a vague total.
    'admin.media.upload' => ['uploads', 'filling a shared-host disk'],
    'admin.payments.export' => ['exports', 'the entire payments table, per call'],
    'admin.analytics.export' => ['exports', 'bulk data leaving the system'],
];

foreach ($required as $name => [$bucket, $why]) {
    $actual = $routes[$name]['rate_limit'] ?? '(none)';
    ok(sprintf('%-26s %s', $name, $why), $actual === $bucket, $actual === $bucket ? $bucket : "expected $bucket, got $actual");
}

echo "\n\033[1mThe console is staff-only, all of it\033[0m\n\n";

/* Every `/admin/*` path must be staff-audience, with sign-in and the second half
   of sign-in as the only exceptions — neither can require a session, because
   neither has one yet.
 *
 * The audience header is also this API's primary CSRF defence, so a wrong value
 * here is two holes rather than one. */
/* The exemptions are exhaustive and each one is public for the same reason:
   nobody holding it has a session yet. Sign-in, the second half of sign-in, and
   the three steps of recovering a forgotten password. Every one of them carries
   its own throttle instead, which is the assertion above.

   Written out by name rather than matched by prefix on purpose — a pattern like
   `admin.auth.*` would exempt the enrolment routes too, and those are exactly
   the ones that must NOT be public. */
$exempt = [
    'admin.auth.login',
    'admin.auth.mfa.verify',
    'admin.auth.password.forgot',
    'admin.auth.password.verify',
    'admin.auth.password.reset',
];
$leaked = [];

foreach ($routes as $name => $route) {
    if (!str_starts_with((string) ($route['path'] ?? ''), '/admin/') || in_array($name, $exempt, true)) {
        continue;
    }

    if (($route['audience'] ?? '') !== 'staff') {
        $leaked[] = $name . ' → ' . (string) ($route['audience'] ?? '(none)');
    }
}

ok('every /admin route is staff-audience', $leaked === [], $leaked === [] ? '' : implode('; ', $leaked));

echo "\n\033[1mAnd the four actions that need the password again\033[0m\n\n";

/* `step_up` is what makes a borrowed console session insufficient for the
   actions that move money or change who can get in. RequireStepUp reads this
   flag and nothing else, so a route that loses it loses the control silently —
   the same failure mode as the buckets above. */
$mustStepUp = [
    'admin.auth.mfa.begin' => 'enrolling an authenticator on somebody else\'s account',
    'admin.auth.mfa.confirm' => 'enrolling an authenticator on somebody else\'s account',
    'admin.auth.mfa.disable' => 'removing a second factor',
    'admin.refunds.create' => 'sending money back',
];

foreach ($mustStepUp as $name => $why) {
    ok(sprintf('%-26s %s', $name, $why), ($routes[$name]['step_up'] ?? false) === true, isset($routes[$name]) ? '' : 'route not found');
}

printf("\n  %d passed, %d failed\n\n", $pass, $fail);

exit($fail === 0 ? 0 : 1);
