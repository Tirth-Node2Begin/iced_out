<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Exception\RateLimitException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Router;
use Iced\Support\Config;
use Iced\Support\RateLimiter;
use Iced\Support\SecuritySignals;
use Throwable;

/**
 * Runs early so every middleware after it can read the route's own metadata
 * (audience, permission, rate class, validation rules, idempotency flag).
 *
 * ── AND COUNTS THE REQUESTS THAT NEVER GET THAT FAR ─────────────────────────
 *
 * Rate limiting sits BELOW this in the pipeline, and this throws 404 and 405. So
 * every request for a path that does not exist skipped rate limiting entirely:
 * an attacker could probe for `/admin`, `/.env`, `/wp-login.php`, old endpoint
 * names and parameter shapes as fast as the network allowed, and nothing counted
 * a single one. The same held for probing verbs on paths that do exist.
 *
 * The obvious fix — move RateLimitByIp above this — cannot work, because the
 * per-route limit CLASS is exactly what this middleware resolves. So the
 * unmatched requests are counted here instead, in one coarse IP bucket, on the
 * way out through the failure. Matched requests are untouched and go on to their
 * own bucket as before.
 *
 * It is deliberately generous: a spidered site or a stale bookmark produces 404s
 * in ordinary use, and this is meant to stop enumeration at speed rather than to
 * punish a broken link.
 */
final class ResolveRoute implements Middleware
{
    private const CLASS_NAME = 'unmatched';

    public function __construct(
        private readonly Router $router,
        private readonly RateLimiter $limiter,
        private readonly Config $config,
        private readonly SecuritySignals $signals,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        try {
            $match = $this->router->match($request->method, $request->path);
        } catch (ApiException $error) {
            $this->countMiss($request);

            throw $error;
        }

        $request->setAttribute('route_match', $match);
        $request->setAttribute('route', $match->route);
        $request->setAttribute('route_params', $match->params);

        return $next($request);
    }

    /**
     * One tick against the caller's NETWORK, and a 429 once it runs out.
     *
     * ── WHY A PREFIX AND NOT THE ADDRESS ────────────────────────────────────
     *
     * Counting per exact IP looked obviously right and was a denial of service.
     * The counter store is one file per key (`FileCacheStore::path`), nothing
     * sweeps it, and this is the only bucket a request can reach WITHOUT being
     * authenticated, matched to a route, or otherwise bounded. So a single
     * request to a non-existent path from each address in an IPv6 /64 — a range
     * one machine can trivially source from — minted an unbounded number of
     * files, none of which ever counted twice.
     *
     * The end state was not a slow disk. It was the inode limit, then `fopen`
     * failing, then `CacheUnavailable`, then every FAIL_CLOSED bucket — `auth`,
     * `payments`, `checkout` — answering 503. Sign-in and checkout down,
     * site-wide, from unauthenticated requests to URLs that do not exist.
     *
     * Bucketing by /24 and /64 makes the key space small and finite, and it is
     * also the more honest unit: someone enumerating endpoints from a subnet is
     * one actor, not 65,536.
     *
     * Never allowed to replace the 404 with something worse than a 429: if the
     * counter store is unusable the original error stands, because refusing to
     * say "that endpoint does not exist" over a cache fault would be an outage
     * in the name of a scanner.
     *
     * @throws RateLimitException
     */
    private function countMiss(Request $request): void
    {
        /** @var array{limit?: int, window?: int} $rule */
        $rule = $this->config->array('app.rate_limits.' . self::CLASS_NAME);

        try {
            $outcome = $this->limiter->consume(
                'rl:ip:unmatched:' . self::network($request->ip),
                (int) ($rule['limit'] ?? 60),
                (int) ($rule['window'] ?? 60),
            );
        } catch (Throwable $error) {
            /* `CacheUnavailable` never reaches here — RateLimiter catches it and
               reports `available: false` — so this is for genuine faults, and it
               is logged rather than swallowed. Returning quietly was hiding the
               exact condition the exception was introduced to make visible. */
            $this->signals->rateLimiterUnavailable([
                'class' => self::CLASS_NAME,
                'detail' => $error->getMessage(),
            ]);

            return;
        }

        if (!$outcome['available']) {
            $this->signals->rateLimiterUnavailable(['class' => self::CLASS_NAME, 'path' => $request->path]);

            return;
        }

        if (!$outcome['allowed']) {
            throw new RateLimitException($outcome['retry_after']);
        }
    }

    /**
     * The caller's network: /24 for IPv4, /64 for IPv6.
     *
     * A prefix rather than an address, so the key space this bucket can create
     * is bounded. An unparseable address falls back to the literal string, which
     * is still finite because `REMOTE_ADDR` is whatever the web server resolved.
     */
    private static function network(string $ip): string
    {
        if (str_contains($ip, ':')) {
            $packed = @inet_pton($ip);

            // First 8 bytes = /64. Hex so the key stays filesystem-safe.
            return $packed === false ? $ip : 'v6:' . bin2hex(substr($packed, 0, 8));
        }

        $parts = explode('.', $ip);

        return count($parts) === 4 ? 'v4:' . $parts[0] . '.' . $parts[1] . '.' . $parts[2] : $ip;
    }
}
