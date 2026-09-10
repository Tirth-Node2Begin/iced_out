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

    /**
     * The pepper, from its OWN secret rather than from the session key.
     *
     * ── THE TRAP THIS CLOSES ────────────────────────────────────────────────
     *
     * This used to read `app.session.secret` directly, so one value did two
     * unrelated jobs: it signed session tokens at rest AND it peppered every
     * password hash. That coupling is invisible until the day it matters, and
     * the day it matters is the worst possible day.
     *
     * Rotating a leaked `SESSION_SECRET` is the standard, obvious response to
     * an exposed `.env`. Doing it here would have signed everyone out — fine,
     * intended — and ALSO made every password hash in the database
     * unverifiable, permanently. Not "everyone must sign in again": everyone
     * must reset their password through a recovery flow that is itself rate
     * limited at five requests an hour per IP. The one control you most want to
     * reach for during an incident was the one that took the shop down.
     *
     * ── WHY A DEFAULT AND NOT A MIGRATION ───────────────────────────────────
     *
     * `PASSWORD_PEPPER` falls back to `SESSION_SECRET`, so on every existing
     * deployment this computes byte-for-byte what it computed before and every
     * stored hash keeps verifying. There is nothing to migrate and no version
     * marker to carry, because nothing about the hashes changes.
     *
     * What changes is that the two CAN now be separated, which is all the
     * incident needs:
     *
     *   1. set PASSWORD_PEPPER to the current SESSION_SECRET value
     *   2. mint a new SESSION_SECRET
     *
     * Sessions all die, passwords all keep working. See the runbook in
     * SECURITY_IMPLEMENTATION_PLAN.md §21.
     *
     * ── THE PEPPER ITSELF STILL CANNOT BE ROTATED ───────────────────────────
     *
     * Changing PASSWORD_PEPPER invalidates every hash, and no amount of
     * indirection avoids that — a pepper is an input to a one-way function.
     * Rotating it means a forced reset for everyone, and it is only warranted if
     * the pepper itself leaked. Doing that gracefully needs a per-hash version
     * column and a two-key verify; it is deliberately not built here, because it
     * is real complexity in the most dangerous method in the codebase for a case
     * this change makes far less likely to arise.
     */
    private function pepper(string $password): string
    {
        $secret = $this->config->string('app.password_pepper');

        if ($secret === '') {
            // Unset ⇒ the historic behaviour, exactly.
            $secret = $this->config->string('app.session.secret');
        }

        return hash_hmac('sha256', $password, 'pwd:' . $secret);
    }
}
