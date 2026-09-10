<?php

declare(strict_types=1);

/**
 * The credential that can replace a password.
 *
 *   php tests/Smoke/password-reset-smoke.php
 *
 * ── THE PROPERTY, AND WHY IT NEEDED A TEST ──────────────────────────────────
 *
 * `auth_tokens` stores the hash of a SIX-DIGIT code. Everything else that goes
 * into that hash is public: the audience is one of two fixed strings, and the
 * email is the account under attack. So while the digest was a bare
 * `hash('sha256', …)`, anyone who could READ the table could enumerate all one
 * million candidates and recover a live code — the measurement below does it in
 * well under a second, in interpreted PHP, on a laptop.
 *
 * That is the difference between "somebody read our database" and "somebody is
 * now signing in as our customers". A leaked backup, a read-only SQL injection,
 * a shared-host neighbour reaching the data directory: any of them becomes an
 * account takeover, because the recovered code sets a password the attacker
 * chooses. The fifteen-minute expiry does not help — deriving the code takes
 * less time than reading the row did.
 *
 * The class docblock on AuthTokenRepository has always said "a dump of this
 * table cannot be replayed against the reset endpoint". This file is what makes
 * that sentence true rather than aspirational, so it asserts BOTH halves: that
 * the flow still works, and that the offline search now fails.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Repository\AuthTokenRepository;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\PasswordHasher;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

$tokens = $app->container->make(AuthTokenRepository::class);
$hasher = $app->container->make(PasswordHasher::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-54s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $tokens, $hasher): void {
        $user = $db->selectOne(
            "SELECT * FROM users WHERE type = 'CUSTOMER' AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1",
        );

        if ($user === null) {
            throw new RuntimeException('Needs a seeded customer — run `php bin/console.php seed`.');
        }

        $email = (string) $user['email'];
        $normalized = UserRepository::normalizeEmail($email);
        $userId = (int) $user['id'];

        /* ---- A DIFFERENT SOURCE ADDRESS PER RUN, NOT JUST PER CALL ---------

           `password_forgot` is five an hour PER IP and the window is an hour, so
           a fixed address exhausts itself after a couple of runs and every later
           run measures the limiter instead of the thing under test.

           The first version of this file numbered addresses from a counter, which
           made them identical on every run — the fourth run got a 429, `$row`
           came back null, and the million-iteration search below then took a
           null offset a million times. Each one is a warning, each warning is a
           line the logger writes to disk, and a ten-second suite became one that
           had to be killed. Hence both this and the explicit check under it. */
        $runSalt = random_int(1, 200);
        $callNumber = 0;

        $post = static function (string $path, array $body) use ($app, &$callNumber, $runSalt): array {
            ++$callNumber;

            $response = $app->handle(new Request(
                method: 'POST',
                path: $path,
                query: [],
                headers: [
                    'x-client-audience' => 'public',
                    'content-type' => 'application/json',
                    'origin' => 'http://127.0.0.1:3000',
                ],
                cookies: [],
                rawBody: (string) json_encode($body),
                ip: sprintf('198.18.%d.%d', $runSalt, $callNumber % 250),
            ));

            return [$response->status(), $response->body()];
        };

        echo "\n\033[1mAsking for a code\033[0m\n\n";

        [$status] = $post('/auth/password/forgot', ['email' => $email]);
        ok('a request for a real address is accepted', $status === 202, "HTTP $status");

        /* ---- THE ASYMMETRY IS DELIBERATE. READ BEFORE "FIXING" IT ----------

           This endpoint NAMES an unknown address, and that is a considered
           decision rather than an oversight — see the long note on
           AuthController::forgotPassword. The short of it: `/auth/register` two
           routes up already answers "an account with that email already exists",
           on a looser limit, so silence here would buy nothing and would cost
           every shopper who mistyped their address a ten-minute wait for mail
           that was never coming.

           The console's twin does the opposite and stays neutral, because the
           console has no public registration and the same answer there WOULD be
           a new oracle.

           Asserted rather than left implicit so that "making the two consistent"
           breaks a test and sends the reader to the reasoning. */
        [$status] = $post('/auth/password/forgot', ['email' => 'nobody-here-' . bin2hex(random_bytes(4)) . '@example.com']);
        ok('an unknown address is named, as documented', $status === 422, "HTTP $status");

        $row = $db->selectOne(
            "SELECT * FROM auth_tokens WHERE user_id = ? AND purpose = 'PASSWORD_RESET' ORDER BY id DESC LIMIT 1",
            [$userId],
        );

        if ($row === null) {
            /* Almost always the `password_forgot` limiter rather than a real
               failure, and it must stop the run rather than fall through: every
               assertion below reads this row, and the search loops a million
               times over whatever it finds. */
            throw new RuntimeException('No reset token was issued — the password_forgot bucket is probably exhausted for this address. Wait an hour or clear the cache directory.');
        }

        ok('the code is stored only as a 32-byte digest', strlen((string) $row['token_hash']) === 32);

        echo "\n\033[1mThe offline search a dump makes possible\033[0m\n\n";

        /* Exactly what somebody holding the table would run: every six-digit
           code, hashed the way the pre-fix code hashed it, compared against the
           stored digest. The email and audience are known to them. */
        $started = microtime(true);
        $recovered = null;

        for ($guess = 0; $guess < 1000000; ++$guess) {
            $digits = sprintf('%06d', $guess);

            if (hash('sha256', 'customer|' . $normalized . '|' . $digits, true) === (string) $row['token_hash']) {
                $recovered = $digits;

                break;
            }
        }

        ok(
            'a million unkeyed guesses do NOT recover the code',
            $recovered === null,
            sprintf('%.2fs of searching, found %s', microtime(true) - $started, $recovered ?? 'nothing'),
        );

        /* The control for that measurement. If the search cannot find a code it
           IS supposed to find, the assertion above proves nothing — it would
           pass just as happily against a broken harness. This is the pre-fix
           stored form, and it must fall. */
        $legacy = hash('sha256', 'customer|' . $normalized . '|' . '738104', true);
        $started = microtime(true);
        $control = null;

        for ($guess = 0; $guess < 1000000; ++$guess) {
            $digits = sprintf('%06d', $guess);

            if (hash('sha256', 'customer|' . $normalized . '|' . $digits, true) === $legacy) {
                $control = $digits;

                break;
            }
        }

        ok(
            '...but the SAME search breaks the old unkeyed form',
            $control === '738104',
            sprintf('recovered %s in %.2fs — this is what was fixed', $control ?? 'nothing', microtime(true) - $started),
        );

        echo "\n\033[1mAnd the flow itself still works\033[0m\n\n";

        /* A known code, planted the way the service plants one. The mailed digits
           never touch the database, so this is the only way to hold both halves. */
        $code = '424242';
        $tokens->supersede($userId, AuthTokenRepository::PURPOSE_PASSWORD_RESET);
        $tokens->issue($userId, AuthTokenRepository::PURPOSE_PASSWORD_RESET, $tokens->hash('customer', $normalized, $code), 900);

        [$status] = $post('/auth/password/verify', ['email' => $email, 'code' => '000000']);
        ok('a wrong code is refused', $status === 422, "HTTP $status");

        [$status] = $post('/auth/password/verify', ['email' => $email, 'code' => $code]);
        ok('the right code verifies', $status === 204, "HTTP $status");

        $next = 'reset-flow-test-password';
        [$status] = $post('/auth/password/reset', ['email' => $email, 'code' => $code, 'password' => $next]);
        ok('...and sets the new password', $status === 204, "HTTP $status");

        $after = $db->selectOne('SELECT password_hash FROM users WHERE id = ?', [$userId]);
        ok('which really is the stored one now', $hasher->verify($next, (string) $after['password_hash']));

        [$status] = $post('/auth/password/reset', ['email' => $email, 'code' => $code, 'password' => 'another-password-here']);
        ok('the code cannot be spent twice', $status === 422, "HTTP $status");

        /* A code issued for the CONSOLE must not open a shop account. The hash
           covers the audience, so the same digits derive a different digest and
           simply do not match — no branch to forget. */
        $tokens->supersede($userId, AuthTokenRepository::PURPOSE_PASSWORD_RESET);
        $tokens->issue($userId, AuthTokenRepository::PURPOSE_PASSWORD_RESET, $tokens->hash('staff', $normalized, $code), 900);

        [$status] = $post('/auth/password/verify', ['email' => $email, 'code' => $code]);
        ok('a STAFF code does not open a customer account', $status === 422, "HTTP $status");

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
