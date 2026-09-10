<?php

declare(strict_types=1);

/**
 * Two-factor sign-in for console accounts.
 *
 *   php tests/Smoke/mfa-smoke.php
 *
 * ── THE PROPERTY THAT MATTERS MOST HERE IS THE ABSENCE OF ONE ───────────────
 *
 * MFA is opt-in and off by default, so the first thing this checks is that an
 * account which has NOT enrolled signs in exactly as it always did. A second
 * factor that changes sign-in for everybody the day it ships is a second factor
 * that gets reverted the same day.
 *
 * After that: a password alone must not produce a usable session, the challenge
 * must be single-use, a wrong code must not be retryable against the same
 * challenge, recovery codes must work once each, and turning it off must need
 * both the password and a live code.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Service\Auth\MfaService;
use Iced\Service\Auth\PasswordHasher;
use Iced\Service\Auth\SessionManager;
use Iced\Support\Totp;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

$mfa = $app->container->make(MfaService::class);
$hasher = $app->container->make(PasswordHasher::class);
$sessions = $app->container->make(SessionManager::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-52s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $mfa, $hasher, $sessions): void {
        $staff = $db->selectOne("SELECT * FROM users WHERE type = 'STAFF' AND deleted_at IS NULL LIMIT 1");

        if ($staff === null) {
            throw new RuntimeException('Needs a seeded staff account — run `php bin/console.php seed`.');
        }

        $userId = (int) $staff['id'];
        $password = 'mfa-test-password';
        $db->statement('UPDATE users SET password_hash = ? WHERE id = ?', [$hasher->hash($password), $userId]);
        $db->statement(
            'INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?',
            [$userId, 'ADMIN'],
        );

        /* A DIFFERENT source address per call, and that is not a trick to dodge
           a check — it is the only way to test a sign-in flow that involves a
           dozen logins against a limiter deliberately set to ten a minute per
           IP. The limiter itself is tested in its own right elsewhere; here it
           would simply mask everything after the tenth assertion. */
        $callNumber = 0;

        $post = static function (string $path, array $body, ?string $cookie = null) use ($app, &$callNumber): array {
            ++$callNumber;

            $headers = [
                'x-client-audience' => $cookie === null ? 'public' : 'admin',
                'content-type' => 'application/json',
                'origin' => 'http://127.0.0.1:8100',
            ];

            $response = $app->handle(new Request(
                method: 'POST',
                path: $path,
                query: [],
                headers: $headers,
                cookies: $cookie === null ? [] : ['io_ssess' => $cookie],
                rawBody: (string) json_encode($body),
                ip: sprintf('198.51.100.%d', $callNumber % 250),
            ));

            return [$response->status(), $response->body(), $response->headers()];
        };

        $login = static fn (): array => $post('/admin/auth/login', ['email' => $staff['email'], 'password' => $password]);

        /* `login_attempts` is an append-only ledger that long predates this test
           and this account has rows in it already, so the assertions near the end
           count only what THIS run adds. */
        $ledgerFrom = (int) $db->selectOne('SELECT COALESCE(MAX(id), 0) AS n FROM login_attempts')['n'];

        echo "\n\033[1mBefore anybody enrols\033[0m\n\n";

        [$status, $body, $headers] = $login();
        ok('sign-in is completely unchanged', $status === 200 && isset($headers['Set-Cookie']), "HTTP $status");
        ok('...and issues a session cookie', str_contains((string) ($headers['Set-Cookie'] ?? ''), 'io_ssess='));

        // A live session, to manage enrolment with.
        $token = $sessions->issue($userId, SessionManager::AUDIENCE_STAFF, new Request('GET', '/', [], [], [], '', '127.0.0.1'))['token'];

        echo "\n\033[1mEnrolling\033[0m\n\n";

        /* Enrolment is STEP-UP gated, and the first assertion here is why.
           Without it a borrowed staff session could enrol its OWN authenticator,
           and `disable` needs the password AND a current code — so the real
           owner, who has the password but not the attacker's secret, could never
           undo it. A password reset does not clear `user_mfa` either. */
        [$status] = $post('/admin/auth/mfa/begin', [], $token);
        ok('enrolling WITHOUT step-up is refused', $status === 428, "HTTP $status");

        [$status] = $post('/admin/auth/step-up', ['password' => $password], $token);
        ok('...and the password elevates the session', $status === 200, "HTTP $status");

        [$status, $body] = $post('/admin/auth/mfa/begin', [], $token);
        ok('begin mints a secret', $status === 200 && str_contains($body, 'otpauth://'), "HTTP $status");

        $secret = (string) json_decode($body, true)['data']['secret'];

        [$status] = $login();
        ok('an UNCONFIRMED enrolment does not gate sign-in', $status === 200, "HTTP $status");

        [$status] = $post('/admin/auth/mfa/confirm', ['code' => '000000'], $token);
        ok('a wrong code does not enable it', $status === 422, "HTTP $status");

        [$status, $body] = $post('/admin/auth/mfa/confirm', ['code' => Totp::codeFor($secret, intdiv(time(), Totp::STEP))], $token);
        $recovery = json_decode($body, true)['data']['recovery_codes'] ?? [];
        ok('a correct code enables it', $status === 200, "HTTP $status");
        ok('...and issues 10 recovery codes', count($recovery) === 10);

        echo "\n\033[1mSigning in with it on\033[0m\n\n";

        [$status, $body, $headers] = $login();
        ok('the password alone gives NO session', $status === 200 && !isset($headers['Set-Cookie']), "HTTP $status");
        ok('...it returns a challenge instead', str_contains($body, '"mfa_required":true'));

        $challenge = (string) json_decode($body, true)['data']['challenge'];

        [$status] = $post('/admin/auth/mfa/verify', ['challenge' => $challenge, 'code' => '000000']);
        ok('a wrong code is refused', $status === 401, "HTTP $status");

        [$status] = $post('/admin/auth/mfa/verify', [
            'challenge' => $challenge,
            'code' => Totp::codeFor($secret, intdiv(time(), Totp::STEP)),
        ]);
        ok('...and the challenge is now spent, so even a RIGHT code fails', $status === 401, "HTTP $status");

        /* A fresh sign-in, done properly.

           The step is deliberately the NEXT one. `confirm()` above proved a code
           for the current step and recorded it as used, and a code may not be
           spent twice — so a real operator waits half a minute for their app to
           roll over, and this does the same thing without sleeping. That the
           current step is refused here is the replay protection working, not a
           fixture problem. */
        [, $body] = $login();
        $challenge = (string) json_decode($body, true)['data']['challenge'];
        $step = intdiv(time(), Totp::STEP) + 1;

        [$status, $body, $headers] = $post('/admin/auth/mfa/verify', ['challenge' => $challenge, 'code' => Totp::codeFor($secret, $step)]);
        ok('a fresh challenge + right code signs in', $status === 200, "HTTP $status");
        ok('...and issues the session cookie', str_contains((string) ($headers['Set-Cookie'] ?? ''), 'io_ssess='));

        echo "\n\033[1mReplay, recovery, and turning it off\033[0m\n\n";

        [, $body] = $login();
        $challenge = (string) json_decode($body, true)['data']['challenge'];
        [$status] = $post('/admin/auth/mfa/verify', ['challenge' => $challenge, 'code' => Totp::codeFor($secret, $step)]);
        ok('the SAME code cannot be used twice', $status === 401, 'replay inside the window is refused');

        [, $body] = $login();
        $challenge = (string) json_decode($body, true)['data']['challenge'];
        [$status] = $post('/admin/auth/mfa/verify', ['challenge' => $challenge, 'code' => $recovery[0]]);
        ok('a recovery code signs in', $status === 200, "HTTP $status");

        [, $body] = $login();
        $challenge = (string) json_decode($body, true)['data']['challenge'];
        [$status] = $post('/admin/auth/mfa/verify', ['challenge' => $challenge, 'code' => $recovery[0]]);
        ok('...and is single use', $status === 401, "HTTP $status");

        $left = count(json_decode((string) $db->selectOne('SELECT recovery_codes FROM user_mfa WHERE user_id = ?', [$userId])['recovery_codes'], true));
        ok('...leaving nine', $left === 9, "$left left");

        echo "\n\033[1mThe ledger, which the lockout reads\033[0m\n\n";

        /* ---- WHY THIS IS HERE ---------------------------------------------

           `recentFailures()` counts failures SINCE THE LAST SUCCESS, and
           AuthService used to write the success row the moment the password
           checked out — before the second factor, and before the session it had
           just minted was revoked again.

           So somebody holding a phished staff password could zero the lockout
           counter on demand: sign in (success recorded), guess a code, sign in
           again, guess another. The login lockout could never engage, no matter
           how many codes they burned through.

           Every sign-in above returned a CHALLENGE, not a session. There must be
           no success rows from any of them. */
        $ledger = static fn (int $success): int => (int) $db->selectOne(
            'SELECT COUNT(*) AS n FROM login_attempts WHERE id > ? AND was_success = ?',
            [$ledgerFrom, $success],
        )['n'];

        /* Eight sign-ins have run, and exactly four of them handed a cookie to
           the caller: the two before MFA was confirmed, the one that passed a
           real TOTP code, and the one that used a recovery code. The other four
           returned a challenge and nothing else — three of them followed by a
           WRONG code — and none of those may appear here as a success. */
        $successes = $ledger(1);
        ok('only completed sign-ins are recorded', $successes === 4, "$successes success rows, expected 4");

        ok('...so a password-only sign-in records nothing at all', $ledger(0) === 0, $ledger(0) . ' failure rows');

        [$status] = $post('/admin/auth/mfa/disable', ['password' => 'wrong', 'code' => Totp::codeFor($secret, intdiv(time(), Totp::STEP))], $token);
        ok('disabling needs the right password', $status === 422, "HTTP $status");

        [$status] = $post('/admin/auth/mfa/disable', ['password' => $password, 'code' => '000000'], $token);
        ok('disabling needs a right code too', $status === 422, "HTTP $status");

        /* A RECOVERY code, not a TOTP one, and for a real reason rather than
           test convenience: every step inside the current window has now been
           spent by the sign-ins above, and the replay guard correctly refuses
           them. An operator in this position waits thirty seconds; a recovery
           code is the other honest way through, and exercising it here proves
           `check()` accepts them everywhere it accepts a TOTP code and not only
           at sign-in. */
        [$status] = $post('/admin/auth/mfa/disable', [
            'password' => $password,
            'code' => $recovery[1],
        ], $token);
        ok('both together turn it off', $status === 200, "HTTP $status");

        [$status, , $headers] = $login();
        ok('and sign-in is back to one step', $status === 200 && isset($headers['Set-Cookie']), "HTTP $status");

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
