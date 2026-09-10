<?php

declare(strict_types=1);

/**
 * The test that did not survive the CRM split — restored, console side.
 *
 *   php tests/Smoke/cross-audience-smoke.php
 *
 * ── WHAT IT GUARDS ──────────────────────────────────────────────────────────
 *
 * That a CUSTOMER session can never act as staff. Three independent mechanisms
 * are supposed to make that true and none of them was exercised end to end:
 *
 *   1. `Authenticate` refuses when X-Client-Audience does not match the route's
 *      own audience — before any cookie is read.
 *   2. `SessionManager::resolve()` reads a DIFFERENT COOKIE NAME per audience,
 *      so a customer cookie is not even looked for on a console route.
 *   3. `SessionManager::resolveToken()` cross-checks `users.type` against the
 *      audience, so even a token pasted into the right cookie resolves to null.
 *
 * ── WHY IT IS NOT ONE TEST BOOTING BOTH APPS ────────────────────────────────
 *
 * It cannot be. Both deployables define `Iced\Kernel\Application` from their own
 * `src/`, so loading the two autoloaders in one process gives two different
 * classes the same name. The note left in StaffAuthFlowTest said restoring this
 * "means an integration test that boots both apps", and that is the one thing
 * PHP will not do.
 *
 * The way through is that the two apps SHARE the session table and the signing
 * secret. A session row minted by either is valid for the other — which is the
 * whole reason the isolation guarantee has to hold in the first place. So this
 * mints a CUSTOMER session using the console's own SessionManager, exactly as
 * the storefront would have written it, and then presents it to the console's
 * own /admin routes. No second codebase required, and it tests the surface that
 * actually has to refuse it.
 *
 * The mirror image — a staff session presented to the storefront — lives in
 * `backend/tests/Smoke/cross-audience-smoke.php`.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Service\Auth\SessionManager;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

/** @var SessionManager $sessions */
$sessions = $app->container->make(SessionManager::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-58s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $sessions): void {
        $staff = $db->selectOne("SELECT * FROM users WHERE type = 'STAFF' AND deleted_at IS NULL LIMIT 1");
        $customer = $db->selectOne("SELECT * FROM users WHERE type = 'CUSTOMER' AND deleted_at IS NULL LIMIT 1");

        if ($staff === null || $customer === null) {
            throw new RuntimeException('Needs a seeded staff and customer account — run `php bin/console.php seed`.');
        }

        /* The seeded console account may have no role in a developer database,
           which would make every permissioned route answer 403 and hide what is
           being tested behind the wrong refusal. Granted inside the transaction,
           so it is rolled back with everything else. */
        $db->statement(
            'INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?',
            [(int) $staff['id'], 'ADMIN'],
        );

        $probe = new Request('GET', '/', [], [], [], '', '127.0.0.1');

        $staffToken = $sessions->issue((int) $staff['id'], SessionManager::AUDIENCE_STAFF, $probe)['token'];
        $customerToken = $sessions->issue((int) $customer['id'], SessionManager::AUDIENCE_CUSTOMER, $probe)['token'];

        $get = static function (string $path, string $audience, array $cookies) use ($app): int {
            return $app->handle(new Request(
                method: 'GET',
                path: $path,
                query: [],
                headers: ['x-client-audience' => $audience],
                cookies: $cookies,
                rawBody: '',
                ip: '127.0.0.1',
            ))->status();
        };

        echo "\n\033[1mA customer session against the console's /admin routes\033[0m\n\n";

        // The control: the guarantee is only interesting if the route works.
        ok(
            'a real staff session opens /admin/auth/session',
            $get('/admin/auth/session', 'admin', ['io_ssess' => $staffToken]) === 200,
        );

        /* 1 — the customer cookie declaring itself a customer. Every /admin
           route is staff-audience, so Authenticate refuses on the audience
           alone, before any cookie is read. */
        ok(
            'customer cookie + customer audience on /admin is refused',
            $get('/admin/auth/session', 'customer', ['io_csess' => $customerToken]) === 403,
        );

        /* 2 — the same cookie, now LYING about its audience. The header matches
           the route, so the audience gate passes; what refuses it is that
           `io_ssess` is a different cookie and is simply not there. */
        ok(
            'customer cookie claiming to be staff is refused',
            $get('/admin/auth/session', 'admin', ['io_csess' => $customerToken]) === 401,
        );

        /* 3 — THE REAL TEST. The raw customer token pasted into the STAFF
           cookie. Both earlier defences are now bypassed: the audience matches
           and the cookie name is right. What must stop it is the token space
           itself — `user_sessions.audience` and the `users.type` cross-check in
           resolveToken(). */
        ok(
            'customer TOKEN inside the staff cookie is refused  [THE GUARANTEE]',
            $get('/admin/auth/session', 'admin', ['io_ssess' => $customerToken]) === 401,
        );

        // The same, against the console screens that carry money and PII.
        foreach (['/admin/orders', '/admin/payments', '/admin/customers', '/admin/audit-logs'] as $path) {
            ok(
                sprintf('customer token cannot read %s', $path),
                $get($path, 'admin', ['io_ssess' => $customerToken]) === 401,
            );
        }

        echo "\n\033[1mSession resolution, directly\033[0m\n\n";

        ok(
            'the customer token resolves to nobody as staff',
            $sessions->resolveToken($customerToken, SessionManager::AUDIENCE_STAFF) === null,
        );
        ok(
            'the staff token resolves to nobody as a customer',
            $sessions->resolveToken($staffToken, SessionManager::AUDIENCE_CUSTOMER) === null,
        );
        ok(
            'each token still resolves in its own space',
            $sessions->resolveToken($staffToken, SessionManager::AUDIENCE_STAFF) !== null
                && $sessions->resolveToken($customerToken, SessionManager::AUDIENCE_CUSTOMER) !== null,
        );

        throw new RuntimeException('__rollback__');
    });
} catch (RuntimeException $error) {
    if ($error->getMessage() !== '__rollback__') {
        fwrite(STDERR, "\n  " . $error->getMessage() . "\n\n");

        exit(1);
    }
}

printf("\n  %d passed, %d failed\n\n", $pass, $fail);

exit($fail === 0 ? 0 : 1);
