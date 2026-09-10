<?php

declare(strict_types=1);

namespace Iced\Support;

use InvalidArgumentException;

/**
 * RFC 6238 time-based one-time passwords, and RFC 4648 base32 to carry the key.
 *
 * ── WHY THIS IS HAND-WRITTEN ────────────────────────────────────────────────
 *
 * The backend has no runtime Composer dependencies — `composer.json` requires
 * PHP and five bundled extensions and nothing else. That is a deliberate and
 * genuinely valuable property: there is no PHP supply-chain surface in
 * production at all, which for a shop taking card payments is worth more than
 * the sixty lines below.
 *
 * TOTP is HMAC plus arithmetic. `hash_hmac` is in the standard library, and the
 * rest is the truncation rule from the RFC. Pulling in a package to do it would
 * trade a known, readable sixty lines for an unknown dependency tree on the one
 * code path that guards the console.
 *
 * ── THE THREE THINGS THAT ARE EASY TO GET WRONG ─────────────────────────────
 *
 * 1. THE WINDOW. Phone clocks drift and people type slowly, so one step either
 *    side of now is accepted — 90 seconds of validity in total. Wider than that
 *    starts to matter for brute force; narrower rejects honest codes and teaches
 *    people the feature is broken.
 *
 * 2. TIMING. `hash_equals`, not `===`. A string comparison that short-circuits
 *    leaks, in its timing, how many leading digits a guess got right, which
 *    turns a million-guess space into sixty.
 *
 * 3. REPLAY. This class reports WHICH step matched, so the caller can refuse a
 *    code that has already been used. Without that, a code is valid for its full
 *    window and anybody who sees it — over a shoulder, in a proxy log — can use
 *    it again before it expires.
 */
final class Totp
{
    /** Seconds per code. Thirty is the universal default; changing it breaks every app. */
    public const STEP = 30;

    /** Digits. Six, because that is what every authenticator shows by default. */
    private const DIGITS = 6;

    /**
     * How many steps either side of now are accepted.
     *
     * One. That is ±30 seconds of clock drift plus the current step — enough for
     * a phone that has not synced today and a person reading digits off it,
     * without tripling the guessing surface.
     */
    private const WINDOW = 1;

    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /** A fresh 160-bit secret, base32-encoded — the size RFC 4226 recommends. */
    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(20));
    }

    /**
     * Checks a code and returns the time step it matched, or null.
     *
     * The step is the return value rather than a boolean on purpose: the caller
     * must store it and refuse anything not strictly greater next time, which is
     * the only thing that stops a code being replayed inside its own window.
     */
    public static function verify(string $secret, string $code, ?int $at = null): ?int
    {
        $digits = preg_replace('/\D+/', '', $code) ?? '';

        if (strlen($digits) !== self::DIGITS) {
            return null;
        }

        /* An unusable secret verifies NOTHING. See the note on codeFor(): this
           check is what stops a blank or corrupt row accepting a fixed code. */
        if (self::base32Decode($secret) === '') {
            return null;
        }

        $now = intdiv($at ?? time(), self::STEP);
        $matched = null;

        for ($offset = -self::WINDOW; $offset <= self::WINDOW; ++$offset) {
            $step = $now + $offset;

            /* Every candidate is checked even after a match — no early return.
               Returning on the first hit would leak, through response timing,
               WHICH step matched, and therefore the victim's clock offset. The
               leak is small; not writing it is free. */
            if (hash_equals(self::codeFor($secret, $step), $digits) && $matched === null) {
                $matched = $step;
            }
        }

        return $matched;
    }

    /**
     * The code for one time step — the truncation of RFC 4226 §5.3.
     *
     * THROWS on an unusable secret rather than returning something. It used to
     * return `'000000'` when `base32Decode` gave back an empty string, which is
     * a fail-OPEN of the worst kind: a `user_mfa` row with a blank or corrupt
     * `secret` — the column is `VARCHAR(64) NOT NULL` with no CHECK, so one can
     * exist — then accepted the literal code `000000` at every time step,
     * forever. `confirm()` would even have ENABLED such a row, because
     * `verify()` returned a step for it.
     *
     * Callers verifying user input go through `verify()`, which screens the
     * secret before ever reaching here, so this exception is a backstop for
     * programming errors rather than a path a request can take.
     *
     * @throws InvalidArgumentException when the secret is not usable base32
     */
    public static function codeFor(string $secret, int $step): string
    {
        $key = self::base32Decode($secret);

        if ($key === '') {
            throw new InvalidArgumentException('A TOTP secret must be non-empty base32.');
        }

        // The counter is eight bytes, big-endian. `J` is unsigned 64-bit BE.
        $hash = hash_hmac('sha1', pack('J', $step), $key, true);

        // Low four bits of the last byte choose where to read the code from.
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;

        $binary = ((ord($hash[$offset]) & 0x7F) << 24)
            | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8)
            | (ord($hash[$offset + 3]) & 0xFF);

        return str_pad((string) ($binary % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    /**
     * The `otpauth://` URI an authenticator app scans.
     *
     * The label carries the account so a phone with several entries can tell them
     * apart, and the issuer is repeated as a parameter because some apps read one
     * and some the other.
     */
    public static function provisioningUri(string $secret, string $account, string $issuer): string
    {
        return sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d',
            rawurlencode($issuer),
            rawurlencode($account),
            $secret,
            rawurlencode($issuer),
            self::DIGITS,
            self::STEP,
        );
    }

    public static function base32Encode(string $bytes): string
    {
        $bits = '';

        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $out = '';

        foreach (str_split($bits, 5) as $chunk) {
            $out .= self::ALPHABET[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
        }

        return $out;
    }

    public static function base32Decode(string $encoded): string
    {
        $clean = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $encoded) ?? '');

        if ($clean === '') {
            return '';
        }

        $bits = '';

        foreach (str_split($clean) as $character) {
            $index = strpos(self::ALPHABET, $character);

            if ($index === false) {
                return '';
            }

            $bits .= str_pad(decbin($index), 5, '0', STR_PAD_LEFT);
        }

        $out = '';

        // Trailing bits that do not make a whole byte are padding, and dropped.
        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $out .= chr(bindec($chunk));
            }
        }

        return $out;
    }
}
