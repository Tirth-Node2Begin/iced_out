<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Support\Config;

/**
 * Argon2id with a pepper derived from SESSION_SECRET (spec §14). The pepper
 * lives in the environment, not the database, so a dumped users table alone is
 * not enough to mount an offline attack.
 *
 * ── WHY THE ALGORITHM IS RESOLVED AT RUNTIME ────────────────────────────────
 *
 * Argon2id is the choice and stays the choice wherever it exists. But it is a
 * COMPILE-TIME option: PHP built without libargon2 does not merely refuse the
 * algorithm, it does not define `PASSWORD_ARGON2ID` at all, and naming an
 * undefined constant is a fatal Error rather than anything catchable at the
 * call site. On such a host every register and every login answered a blanket
 * ICE-SYS-500 while the rest of the shop worked perfectly — which reads as a
 * broken application rather than a missing build flag, and says so nowhere.
 *
 * `password_algos()` is asked instead, so the same code runs on both kinds of
 * host: Argon2id where it exists, bcrypt at cost 12 where it does not.
 *
 * The consequence to know about: a hash is only verifiable where its algorithm
 * exists. An Argon2id hash carried in on a seed or a database dump — the staff
 * account is one — cannot be checked by a PHP without Argon2id, and
 * password_verify() will simply return false. Those accounts need their
 * passwords set again on that host; verify() below cannot rescue them, and
 * pretending otherwise would be worse than the honest false.
 */
final class PasswordHasher
{
    /** Cost 12 ≈ 250 ms on a shared host: the usual floor for bcrypt today. */
    private const BCRYPT_COST = 12;

    private const ARGON2_OPTIONS = [
        'memory_cost' => 65536,
        'time_cost' => 4,
        'threads' => 1,
    ];

    public function __construct(private readonly Config $config)
    {
    }

    public function hash(string $password): string
    {
        return password_hash($this->pepper($password), $this->algorithm(), $this->options());
    }

    public function verify(string $password, string $hash): bool
    {
        if ($hash === '') {
            // Still spend the time: an account with no password must not be
            // distinguishable by response time from one with a wrong password.
            // The dummy is in whichever algorithm this host actually has, or the
            // comparison returns instantly and gives the distinction back.
            password_verify($this->pepper($password), $this->dummyHash());

            return false;
        }

        return password_verify($this->pepper($password), $hash);
    }

    public function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, $this->algorithm(), $this->options());
    }

    /**
     * Argon2id where the build has it, bcrypt where it does not.
     *
     * password_algos() reports what this binary can actually do, which is the
     * only honest source: the constants are absent rather than merely unusable
     * when support was left out.
     */
    private function algorithm(): string
    {
        return in_array('argon2id', password_algos(), true) ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }

    /** @return array<string, int> */
    private function options(): array
    {
        return $this->algorithm() === PASSWORD_BCRYPT
            ? ['cost' => self::BCRYPT_COST]
            : self::ARGON2_OPTIONS;
    }

    private function dummyHash(): string
    {
        return $this->algorithm() === PASSWORD_BCRYPT
            ? '$2y$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            : '$argon2id$v=19$m=65536,t=4,p=1$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    }

    private function pepper(string $password): string
    {
        $secret = $this->config->string('app.session.secret');

        return hash_hmac('sha256', $password, 'pwd:' . $secret);
    }
}
