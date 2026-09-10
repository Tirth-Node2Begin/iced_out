<?php

declare(strict_types=1);

/**
 * Blocking a customer actually blocks them.
 *
 *   php tests/Smoke/blocked-account-smoke.php
 *
 * ── WHAT WENT WRONG ─────────────────────────────────────────────────────────
 *
 * `users.status` has carried BLOCKED since the console shipped, the register
 * displayed it, `Principal::isBlocked()` was written to test it — and nothing
 * ever called that method. Not one line. So "Block customer" wrote a string to a
 * column that no code path read: the account signed in, ordered, and spent
 * wallet credit exactly as before, while the console showed it as Blocked. The
 * development database still holds BLOCKED rows that would sign in today.
 *
 * That is the worst shape a security control can take. A missing feature gets
 * noticed the first time somebody looks for it; a control that is present in the
 * UI, present in the database, and absent in the middleware gets TRUSTED. Staff
 * block an abusive account, watch the row go green-to-red, and move on.
 *
 * ── THE TWO HALVES, AND WHY BOTH ────────────────────────────────────────────
 *
 * Refusing a blocked account at sign-in is the obvious half and the less
 * important one. Whoever is being blocked is, almost by definition, holding a
 * live session at that moment — that is usually WHY they are being blocked — and
 * a customer session lasts days. A door check alone makes "block this customer"
 * take effect somewhere between now and next week, depending on when they happen
 * to sign out.
 *
 * So the second half is `SessionManager::resolveToken()`, which every
 * authenticated request already goes through and which already had the status in
 * hand. That is what this file spends most of its assertions on.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Service\Auth\PasswordHasher;
use Iced\Service\Auth\SessionManager;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

$hasher = $app->container->make(PasswordHasher::class);
$sessions = $app->container->make(SessionManager::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-54s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $hasher, $sessions): void {
        $customer = $db->selectOne(
            "SELECT * FROM users WHERE type = 'CUSTOMER' AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1",
        );

        if ($customer === null) {
            throw new RuntimeException('Needs a seeded customer — run `php bin/console.php seed`.');
        }

        $userId = (int) $customer['id'];
        $password = 'blocked-account-test';
        $db->statement('UPDATE users SET password_hash = ? WHERE id = ?', [$hasher->hash($password), $userId]);

        /* A different source address per call: the `auth` bucket allows ten a
           minute per IP and this signs in more often than that. The limiter has
           its own tests; here it would only mask later assertions. */
        $callNumber = 0;

        $call = static function (string $method, string $path, array $body = [], ?string $cookie = null) use ($app, &$callNumber): array {
            ++$callNumber;

            $response = $app->handle(new Request(
                method: $method,
                path: $path,
                query: [],
                headers: [
                    // `public` for /auth/login, `customer` once there is a session:
                    // Authenticate refuses a customer route whose caller has not
                    // declared that audience, before any cookie is read.
                    'x-client-audience' => $cookie === null ? 'public' : 'customer',
                    'content-type' => 'application/json',
                    'origin' => 'http://127.0.0.1:3000',
                ],
                cookies: $cookie === null ? [] : ['io_csess' => $cookie],
                rawBody: (string) json_encode($body),
                ip: sprintf('203.0.113.%d', $callNumber % 250),
            ));

            return [$response->status(), $response->body()];
        };

        $login = static fn (): array => $call('POST', '/auth/login', ['email' => $customer['email'], 'password' => $password]);

        echo "\n\033[1mWhile the account is ACTIVE\033[0m\n\n";

        [$status, $body] = $login();
        ok('signing in works', $status === 200, "HTTP $status");

        /* The live session that the block has to kill. Minted BEFORE the block,
           which is the entire point — this is the attacker's or the abuser's
           existing tab, not a fresh sign-in they have to attempt. */
        $token = $sessions->issue($userId, SessionManager::AUDIENCE_CUSTOMER, new Request('GET', '/', [], [], [], '', '127.0.0.1'))['token'];

        [$status] = $call('GET', '/me', [], $token);
        ok('and the session reads its own profile', $status === 200, "HTTP $status");

        echo "\n\033[1mThe moment somebody blocks them\033[0m\n\n";

        $db->statement("UPDATE users SET status = 'BLOCKED' WHERE id = ?", [$userId]);

        /* THE ASSERTION THAT WAS FALSE BEFORE THIS WORK. No sign-out, no expiry,
           no waiting: the very next request on the session they already hold. */
        [$status, $body] = $call('GET', '/me', [], $token);
        ok('the EXISTING session stops resolving at once', $status === 401, "HTTP $status");

        ok('...and it reads as signed out, not as an error', str_contains($body, 'ICE-AUTH-401'), substr($body, 0, 60));

        [$status, $body] = $login();
        ok('signing in again is refused', $status === 403, "HTTP $status");
        ok('...with a reason a human can act on', str_contains($body, 'ICE-AUTH-403-BLOCKED'), substr($body, 0, 60));

        /* The password is RIGHT and the answer is still no. Worth stating
           separately: the refusal must not be reachable by guessing an address,
           and it must not be avoidable by knowing the password. */
        [$status] = $call('POST', '/auth/login', ['email' => $customer['email'], 'password' => 'definitely-wrong']);
        ok('a wrong password still says only "does not match"', $status === 401, "HTTP $status");

        $fresh = $sessions->issue($userId, SessionManager::AUDIENCE_CUSTOMER, new Request('GET', '/', [], [], [], '', '127.0.0.1'))['token'];
        [$status] = $call('GET', '/me', [], $fresh);
        ok('a session minted for them anyway is still dead', $status === 401, "HTTP $status");

        echo "\n\033[1mThe domain the code fails closed against\033[0m\n\n";

        /* Both new checks are written as `!== 'ACTIVE'` rather than `=== 'BLOCKED'`,
           so a state nobody taught them about is refused rather than waved
           through. That branch cannot be reached from here, and this asserts WHY:
           `ck_users_status` will not let a third value into the column.

           The code keeps the fail-closed form anyway, because the constraint is
           the less portable of the two. CHECK constraints are parsed and ignored
           by MariaDB before 10.2 and by MySQL before 8.0.16, and this schema is
           imported onto whatever the shared host provides. Where the constraint
           is silently a no-op, the `!== 'ACTIVE'` test is the only thing left. */
        $rejected = false;

        try {
            $db->statement("UPDATE users SET status = 'PENDING_REVIEW' WHERE id = ?", [$userId]);
        } catch (Throwable $error) {
            $rejected = str_contains($error->getMessage(), 'ck_users_status');
        }

        ok('the database itself refuses a third status', $rejected, 'ck_users_status holds');

        echo "\n\033[1mAnd unblocking gives it back\033[0m\n\n";

        $db->statement("UPDATE users SET status = 'ACTIVE' WHERE id = ?", [$userId]);

        [$status] = $call('GET', '/me', [], $token);
        ok('the ORIGINAL session works again', $status === 200, "HTTP $status");

        [$status] = $login();
        ok('and so does signing in', $status === 200, "HTTP $status");

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
