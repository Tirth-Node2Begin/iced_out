<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\ForbiddenException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Config;

/**
 * The CSRF defence of spec §5.2. The frontend sends no CSRF token — requiring
 * one would break every mutation — so cookie-authenticated writes are guarded
 * by SameSite=Lax plus this Origin/Referer check.
 */
final class OriginCheck implements Middleware
{
    public function __construct(private readonly Config $config)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        if (!$request->isMutation()) {
            return $next($request);
        }

        if (!$request->attribute('principal') instanceof Principal) {
            // No session cookie in play ⇒ nothing for CSRF to ride on.
            return $next($request);
        }

        /**
         * Authenticated by a bearer token rather than by the cookie, so there is
         * again nothing for CSRF to ride on: a browser attaches a cookie to a
         * cross-site request all by itself, and attaches an Authorization header
         * to nothing at all.
         *
         * This is what lets the phone WRITE. A native HTTP client sends neither
         * Origin nor Referer, so before this every authenticated POST, PATCH and
         * DELETE from the app was refused here — it could sign in and read, and
         * could not put a single item in a bag. `auth_credential` is set by
         * `SessionManager::resolve` and only for a token that resolved, so this
         * cannot be waved past with an invented header.
         */
        if ($request->attribute('auth_credential') === 'bearer') {
            return $next($request);
        }

        $origin = $request->header('origin');

        if ($origin === '') {
            $referer = $request->header('referer');

            if ($referer === '') {
                throw new ForbiddenException('This request is missing its origin and was refused.');
            }

            $scheme = parse_url($referer, PHP_URL_SCHEME);
            $host = parse_url($referer, PHP_URL_HOST);
            $port = parse_url($referer, PHP_URL_PORT);

            if (!is_string($scheme) || !is_string($host)) {
                throw new ForbiddenException('This request is missing its origin and was refused.');
            }

            $origin = $scheme . '://' . $host . (is_int($port) ? ':' . $port : '');
        }

        if (!in_array($origin, self::trustedOrigins($this->config), true)) {
            throw new ForbiddenException('This request came from an untrusted origin.');
        }

        return $next($request);
    }

    /**
     * The origins allowed to drive a cookie-authenticated write.
     *
     * ── WHY THIS IS NO LONGER THE CORS LIST ─────────────────────────────────
     *
     * It used to read `app.cors_allowed_origins`, so one variable answered two
     * unrelated questions: "which origins may READ a response cross-site" and
     * "which origins may SPEND this shopper's money". Those have very different
     * costs when you get them wrong, and they were coupled in the direction that
     * hides the danger — the pressure to edit `CORS_ALLOWED_ORIGINS` comes from a
     * preflight failing during development, the fix is to add an origin, and the
     * side effect nobody sees is that the same origin is now trusted to place
     * orders and change passwords.
     *
     * So CSRF trust gets its own variable. `TRUSTED_ORIGINS` names the surfaces
     * that are genuinely this application's own front end and nothing else. In
     * production it stays EMPTY: the storefront and its API are one origin, so
     * `app.url` alone is the whole list.
     *
     * ── IT FALLS BACK, SO NOTHING BREAKS ────────────────────────────────────
     *
     * Unset, this behaves exactly as it did — CORS list plus `app.url` — so every
     * existing deployment and every development machine keeps working with no
     * change. Setting it is what narrows the trust.
     *
     * ── THE RULE FOR THE CRM ────────────────────────────────────────────────
     *
     * The storefront's origin must NEVER appear in the console's list, or a
     * cross-site request from a compromised shop page could drive console
     * mutations with a staff cookie. They are separate hosts precisely so that
     * this is impossible; a trusted-origin entry would hand it back.
     *
     * ── STATIC, SO THE READINESS ENDPOINT CAN ASK THE SAME QUESTION ─────────
     *
     * `/ready` reports whether any loopback or private-network origin is trusted
     * in production, and a check like that is worth nothing if it computes the
     * list a second way. Two implementations drift, and the one that drifts is
     * always the one nobody is running in anger. So there is one method and both
     * callers use it.
     *
     * @return list<string>
     */
    public static function trustedOrigins(Config $config): array
    {
        /** @var list<string> $configured */
        $configured = $config->array('app.trusted_origins');

        // Unset ⇒ the historic behaviour, so nothing that works today stops.
        if ($configured === []) {
            /** @var list<string> $configured */
            $configured = $config->array('app.cors_allowed_origins');
        }

        $appUrl = $config->string('app.url');

        if ($appUrl !== '') {
            $scheme = parse_url($appUrl, PHP_URL_SCHEME);
            $host = parse_url($appUrl, PHP_URL_HOST);
            $port = parse_url($appUrl, PHP_URL_PORT);

            if (is_string($scheme) && is_string($host)) {
                $configured[] = $scheme . '://' . $host . (is_int($port) ? ':' . $port : '');
            }
        }

        return array_values(array_unique($configured));
    }
}
