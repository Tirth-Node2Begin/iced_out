<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\RateLimitException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Support\Clock;
use Iced\Support\Config;
use Iced\Support\SecuritySignals;
use Iced\Support\Totp;

/**
 * Second-factor sign-in for console accounts.
 *
 * ── IT IS OFF UNTIL SOMEBODY TURNS IT ON ────────────────────────────────────
 *
 * `isEnabled()` is false for every account with no CONFIRMED enrolment, and
 * that is every account the moment this ships. Sign-in is byte-for-byte
 * unchanged for them. Nobody is locked out by deploying this, and an enrolment
 * that is started and abandoned changes nothing either — the row exists with a
 * null `confirmed_at` and is ignored.
 *
 * ── THE THREE-STEP ENROLMENT, AND WHY IT IS THREE ───────────────────────────
 *
 *   begin()    mints a secret and hands back the otpauth URI to scan. Nothing
 *              is enabled. Re-callable, because people close the dialog.
 *   confirm()  takes a code generated FROM that secret. Only now is it enabled,
 *              and only now are recovery codes issued.
 *   disable()  needs the password and a current code.
 *
 * The middle step is the one that matters: without it, an account could enable
 * MFA against a secret nobody successfully scanned and lock itself out at the
 * next sign-in. Proving one code before switching it on is the difference
 * between a security feature and a support ticket.
 *
 * ── WHAT HAPPENS WHEN THE PHONE IS LOST ─────────────────────────────────────
 *
 * Ten single-use recovery codes, issued once at `confirm()` and stored HASHED —
 * they are credentials, and unlike the TOTP secret there is no reason to keep
 * them reversible. Using one consumes it. When they run out, an administrator
 * with database access clears the row; that is deliberate, because any
 * self-service reset path is a way around the second factor.
 *
 * ── THE SECRET IS STORED IN THE CLEAR, AND THAT IS NOT A SHORTCUT ───────────
 *
 * TOTP is symmetric: the server computes the same code the phone does, so it
 * must hold the same secret. It cannot be hashed the way a password is. The
 * consequence to be honest about is that `user_mfa.secret` is as sensitive as
 * the password column is not — a database dump plus that column IS the second
 * factor, which is why the wider plan puts database exposure so high.
 */
final class MfaService
{
    /** Wrong codes before the account is made to wait. */
    private const MAX_ATTEMPTS = 5;

    /** How long that wait is. */
    private const LOCKOUT_SECONDS = 900;

    /** How long a half-finished sign-in stays valid. */
    private const CHALLENGE_SECONDS = 300;

    private const RECOVERY_CODES = 10;

    public function __construct(
        private readonly Database $db,
        private readonly PasswordHasher $hasher,
        private readonly Config $config,
        private readonly Clock $clock,
        private readonly SecuritySignals $signals,
    ) {
    }

    /** Whether this account must present a second factor to sign in. */
    public function isEnabled(int $userId): bool
    {
        return $this->db->selectOne(
            'SELECT id FROM user_mfa WHERE user_id = ? AND confirmed_at IS NOT NULL LIMIT 1',
            [$userId],
        ) !== null;
    }

    /**
     * Starts (or restarts) enrolment. Returns the secret and the URI to scan.
     *
     * Restarting is allowed and replaces the secret, because the common reason to
     * be here twice is a dialog closed before the code was scanned. It refuses
     * once enrolment is CONFIRMED — changing the secret on a live enrolment would
     * be a way to swap somebody else's second factor for your own.
     *
     * @return array{secret: string, uri: string}
     */
    public function begin(int $userId, string $email): array
    {
        if ($this->isEnabled($userId)) {
            throw ValidationException::field(
                'mfa',
                'Two-factor authentication is already on for this account. Turn it off first.',
                'ICE-AUTH-422',
            );
        }

        $secret = Totp::generateSecret();

        $this->db->statement(
            'INSERT INTO user_mfa (user_id, secret, created_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE secret = VALUES(secret), confirmed_at = NULL,
                                     recovery_codes = NULL, last_used_step = NULL,
                                     failed_attempts = 0, locked_until = NULL',
            [$userId, $secret, $this->clock->nowString()],
        );

        return [
            'secret' => $secret,
            'uri' => Totp::provisioningUri($secret, $email, $this->config->string('app.mail.from_name', 'Iced_out')),
        ];
    }

    /**
     * Proves a code against the pending secret and switches MFA on.
     *
     * @return list<string> the recovery codes, shown once and never again
     */
    public function confirm(int $userId, string $code): array
    {
        $row = $this->db->selectOne('SELECT * FROM user_mfa WHERE user_id = ? LIMIT 1', [$userId]);

        if ($row === null) {
            throw ValidationException::field('code', 'Start setting up two-factor authentication first.', 'ICE-AUTH-422');
        }

        if ($row['confirmed_at'] !== null) {
            throw ValidationException::field('mfa', 'Two-factor authentication is already on.', 'ICE-AUTH-422');
        }

        $step = Totp::verify((string) $row['secret'], $code);

        if ($step === null) {
            throw ValidationException::field('code', 'That code is not right. Check the app and try again.', 'ICE-AUTH-422');
        }

        $plain = [];
        $hashed = [];

        for ($i = 0; $i < self::RECOVERY_CODES; ++$i) {
            /* FIVE bytes a half, not two. The first version used
               `bin2hex(random_bytes(2))` twice — eight hex characters, 32 bits —
               and with ten live at once that is about 2^28.7 of real entropy
               against an endpoint that guesses in parallel. These are a full
               replacement for the second factor; they need to be as hard to
               guess as the thing they replace.

               Grouped with a hyphen because they get written down and read back
               by a person under stress. */
            $one = sprintf('%s-%s', bin2hex(random_bytes(5)), bin2hex(random_bytes(5)));
            $plain[] = $one;
            $hashed[] = $this->hasher->hash($one);
        }

        $this->db->statement(
            'UPDATE user_mfa SET confirmed_at = ?, recovery_codes = ?, last_used_step = ?,
                                 failed_attempts = 0, locked_until = NULL
              WHERE user_id = ?',
            [$this->clock->nowString(), (string) json_encode($hashed), $step, $userId],
        );

        $this->signals->privilegedAction('mfa_enabled', ['user_id' => $userId]);

        return $plain;
    }

    /** Turns MFA off. Needs the password AND a current code — either alone is not enough. */
    public function disable(int $userId, string $password, string $code): void
    {
        $user = $this->db->selectOne('SELECT password_hash FROM users WHERE id = ?', [$userId]);

        if ($user === null || !$this->hasher->verify($password, (string) $user['password_hash'])) {
            throw ValidationException::field('password', 'That is not your password.', 'ICE-AUTH-422');
        }

        if (!$this->check($userId, $code)) {
            throw ValidationException::field('code', 'That code is not right.', 'ICE-AUTH-422');
        }

        $this->db->statement('DELETE FROM user_mfa WHERE user_id = ?', [$userId]);
        $this->signals->privilegedAction('mfa_disabled', ['user_id' => $userId]);
    }

    /**
     * Verifies a code or a recovery code, with throttling and replay protection.
     *
     * Six digits is a million possibilities and the window accepts three of them
     * at a time, so an unthrottled endpoint here is brute-forceable in hours.
     * Five wrong answers buys a fifteen-minute wait.
     */
    public function check(int $userId, string $code): bool
    {
        $row = $this->db->selectOne('SELECT * FROM user_mfa WHERE user_id = ? LIMIT 1', [$userId]);

        if ($row === null || $row['confirmed_at'] === null) {
            return false;
        }

        if ($row['locked_until'] !== null && (string) $row['locked_until'] > $this->clock->nowString()) {
            throw new RateLimitException(
                self::LOCKOUT_SECONDS,
                'Too many incorrect codes. Please wait fifteen minutes and try again.',
            );
        }

        /* THE LOCKOUT HAS EXPIRED, SO THE COUNTER MUST GO WITH IT.
           `failed_attempts` used to decay only on a SUCCESSFUL code, so once it
           reached five it stayed there — and every later wrong code wrote a
           fresh fifteen-minute lock. Anyone holding the password could keep a
           staff member locked out permanently with one request every quarter of
           an hour, and nothing in the console could clear it. */
        if ($row['locked_until'] !== null) {
            $this->db->statement(
                'UPDATE user_mfa SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?',
                [$userId],
            );
            $row['failed_attempts'] = 0;
            $row['locked_until'] = null;
        }

        $step = Totp::verify((string) $row['secret'], $code);

        if ($step !== null) {
            /* A code already spent is refused for the rest of its window —
               otherwise anyone who reads one over a shoulder or out of a proxy
               log has up to ninety seconds to use it again.

               THE GUARD IS THE `WHERE`, NOT THE `IF`. This was a read, a
               decision, and then an unconditional write: two requests carrying
               the same captured code both read the old `last_used_step`, both
               decided it was fresh, and both succeeded. Making the comparison
               part of the UPDATE means the database arbitrates — the second
               writer changes zero rows and is told so. */
            $advanced = $this->db->statement(
                'UPDATE user_mfa
                    SET last_used_step = ?, failed_attempts = 0, locked_until = NULL
                  WHERE user_id = ?
                    AND (last_used_step IS NULL OR last_used_step < ?)',
                [$step, $userId, $step],
            );

            if ($advanced > 0) {
                return true;
            }

            // Replay: somebody else already spent this step.
            $this->fail($userId);

            return false;
        }

        if ($this->consumeRecoveryCode($userId, $row, $code)) {
            return true;
        }

        $this->fail($userId);

        return false;
    }

    /**
     * A half-finished sign-in: the password was right, the code is still owed.
     *
     * Deliberately not a session. It grants nothing, it cannot be presented to
     * any other endpoint, and it expires in five minutes. The raw ticket goes to
     * the caller once; only its HMAC is stored, exactly as session tokens are.
     */
    public function issueChallenge(int $userId, string $audience, Request $request): string
    {
        $token = bin2hex(random_bytes(32));

        $this->db->statement(
            'INSERT INTO mfa_challenges (user_id, audience, token_hash, ip, user_agent, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $userId,
                $audience,
                $this->hashToken($token),
                $request->ip,
                mb_substr($request->header('user-agent'), 0, 255),
                $this->clock->addSeconds(self::CHALLENGE_SECONDS)->format(Clock::STORAGE_FORMAT),
                $this->clock->nowString(),
            ],
        );

        return $token;
    }

    /**
     * Spends a challenge and returns whose it was, or null.
     *
     * `consumed_at IS NULL` in the WHERE of the UPDATE, so two requests racing
     * the same ticket cannot both win — the second changes zero rows.
     */
    public function consumeChallenge(string $token, string $audience, ?Request $request = null): ?int
    {
        $row = $this->db->selectOne(
            'SELECT id, user_id, ip FROM mfa_challenges
              WHERE token_hash = ? AND audience = ? AND consumed_at IS NULL AND expires_at > ?
              LIMIT 1',
            [$this->hashToken($token), $audience, $this->clock->nowString()],
        );

        if ($row === null) {
            return null;
        }

        $spent = $this->db->statement(
            'UPDATE mfa_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL',
            [$this->clock->nowString(), (int) $row['id']],
        );

        if ($spent < 1) {
            return null;
        }

        /* ---- THE ADDRESS IS REPORTED, NOT ENFORCED -------------------------
         *
         * `issueChallenge` has always recorded the address a challenge was
         * issued to, and nothing has ever looked at it. The obvious next step is
         * to refuse a challenge redeemed from somewhere else, and that is
         * deliberately NOT what this does.
         *
         * What a hard binding would buy: nothing much. A challenge grants no
         * access on its own — it is single-use, five minutes long, and useless
         * without a code from the authenticator. An attacker who has somehow
         * obtained a challenge still cannot pass the factor it gates, so
         * refusing them at the address check only stops an attack that the code
         * check stops anyway.
         *
         * What it would cost: real sign-ins. This is an Indian storefront's
         * console, largely operated from mobile networks behind carrier-grade
         * NAT, where the public address can change between two requests a minute
         * apart — and a phone that switches from mobile data to office wifi
         * while the operator opens their authenticator app does exactly that.
         * The failure would be "your sign-in expired, try again", repeatedly,
         * with nothing on screen explaining why, and the fix people would find
         * is to turn MFA off.
         *
         * So it is recorded as a signal. A mismatch is genuinely interesting —
         * it is what phishing-relay and session-fixation attempts look like —
         * and belongs in front of whoever reads the security log, where a human
         * can weigh it against everything else that happened. It is not strong
         * enough on its own to lock somebody out of their own console. */
        if ($request !== null && (string) $row['ip'] !== '' && (string) $row['ip'] !== $request->ip) {
            $this->signals->privilegedAction('mfa_challenge_address_changed', [
                'user_id' => (int) $row['user_id'],
                'issued_to' => (string) $row['ip'],
                'redeemed_from' => $request->ip,
            ]);
        }

        return (int) $row['user_id'];
    }

    /** Expired and spent tickets. Called by `console.php sweep`. */
    public function purgeChallenges(): int
    {
        return $this->db->statement(
            'DELETE FROM mfa_challenges WHERE expires_at < ? OR consumed_at IS NOT NULL',
            [$this->clock->nowString()],
        );
    }

    /** @param array<string, mixed> $row */
    private function consumeRecoveryCode(int $userId, array $row, string $code): bool
    {
        $normalized = strtolower(trim($code));

        /* SHAPE FIRST, HASHING SECOND — and this is a denial-of-service fix, not
           tidiness. Every value that reaches here is compared against up to ten
           stored hashes, and the hasher is Argon2id at 64 MiB. A six-digit TOTP
           attempt that misses therefore used to cost the server ten Argon2id
           verifications: a tenfold CPU-and-memory amplifier on a PUBLIC
           sign-in endpoint, reachable by anyone who knows a staff email.

           A recovery code is `10 hex-10 hex`. Anything that is not that cannot
           match a stored hash, so refusing it here costs one regex instead. */
        if (preg_match('/^[0-9a-f]{10}-[0-9a-f]{10}$/', $normalized) !== 1) {
            return false;
        }

        $stored = json_decode((string) ($row['recovery_codes'] ?? '[]'), true);

        if (!is_array($stored)) {
            return false;
        }

        foreach ($stored as $index => $hash) {
            if (!is_string($hash) || !$this->hasher->verify($normalized, $hash)) {
                continue;
            }

            // Single use: it is removed, not marked.
            unset($stored[$index]);

            /* Written back with the OLD list in the WHERE, so two codes spent at
               the same moment cannot each write a list that still contains the
               other. The loser changes nothing and is treated as a miss, which
               costs that caller one unused recovery code and never mints one
               back. */
            $replaced = $this->db->statement(
                'UPDATE user_mfa SET recovery_codes = ?, failed_attempts = 0, locked_until = NULL
                  WHERE user_id = ? AND recovery_codes = ?',
                [(string) json_encode(array_values($stored)), $userId, (string) $row['recovery_codes']],
            );

            if ($replaced === 0) {
                return false;
            }

            $this->signals->privilegedAction('mfa_recovery_code_used', [
                'user_id' => $userId,
                'remaining' => count($stored),
            ]);

            return true;
        }

        return false;
    }

    /**
     * Charges one wrong answer, and locks the account on the fifth.
     *
     * INCREMENTED IN SQL, not in PHP. This used to read `failed_attempts` into a
     * variable, add one, and write the result — so a burst of concurrent
     * attempts all read the same value and all wrote the same value, and the
     * five-attempt lockout never tripped. Someone holding a leaked password
     * could brute-force six digits at whatever rate they could open connections,
     * with only the per-IP limit in the way and that defeated by distribution.
     *
     * `failed_attempts = failed_attempts + 1` makes every attempt count exactly
     * once however many arrive together, and the lock is applied in the same
     * statement by a CASE over the incremented value.
     */
    private function fail(int $userId): void
    {
        $this->db->statement(
            'UPDATE user_mfa
                SET failed_attempts = failed_attempts + 1,
                    locked_until = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_until END
              WHERE user_id = ?',
            [
                self::MAX_ATTEMPTS,
                $this->clock->addSeconds(self::LOCKOUT_SECONDS)->format(Clock::STORAGE_FORMAT),
                $userId,
            ],
        );

        $row = $this->db->selectOne('SELECT failed_attempts FROM user_mfa WHERE user_id = ?', [$userId]);
        $attempts = (int) ($row['failed_attempts'] ?? 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            $this->signals->authLockout(['reason' => 'mfa', 'user_id' => $userId, 'attempts' => $attempts]);
        }
    }

    /** The same construction session tokens use — never store the raw value. */
    private function hashToken(string $token): string
    {
        return hash_hmac('sha256', $token, $this->config->string('app.session.secret'), true);
    }
}
