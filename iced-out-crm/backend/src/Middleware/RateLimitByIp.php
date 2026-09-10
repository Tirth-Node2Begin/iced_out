<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Exception\RateLimitException;
use Iced\Kernel\Exception\ServiceUnavailableException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Support\Config;
use Iced\Support\RateLimiter;
use Iced\Support\SecuritySignals;

/** First half of spec §4.7 — the IP-scoped buckets (auth, catalog, contact, webhooks). */
final class RateLimitByIp implements Middleware
{
    /**
     * Buckets where being unable to count means REFUSING, not waving through.
     *
     * The distinction is a judgement about which failure hurts more. If the
     * counter store is unusable, an unlimited `catalog` bucket means product
     * listings are served without throttling — untidy. An unlimited `auth`
     * bucket means unlimited password guesses, and an unlimited `checkout`
     * bucket means unlimited stock reservations. Those are not untidy.
     *
     * So these fail closed with a 503 that asks for a retry, and everything else
     * fails open and is logged. A shop that cannot count is briefly worse at
     * serving pages; it must never be briefly defenceless.
     */
    private const FAIL_CLOSED = ['auth', 'password_forgot', 'password_otp', 'payments', 'checkout', 'uploads'];
    public function __construct(
        private readonly RateLimiter $limiter,
        private readonly Config $config,
        private readonly SecuritySignals $signals,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');
        $class = $route instanceof Route ? $route->rateLimit : 'default';
        /** @var array{limit?: int, window?: int, scope?: string} $rule */
        $rule = $this->config->array('app.rate_limits.' . $class);

        $scope = is_string($rule['scope'] ?? null) ? $rule['scope'] : 'ip';

        if (!in_array($scope, ['ip', 'both'], true)) {
            return $next($request);
        }

        $limit = (int) ($rule['limit'] ?? 120);
        $window = (int) ($rule['window'] ?? 60);
        $outcome = $this->limiter->consume(sprintf('rl:ip:%s:%s', $class, $request->ip), $limit, $window);

        if (!$outcome['available']) {
            $this->signals->rateLimiterUnavailable(['class' => $class, 'path' => $request->path]);

            if (in_array($class, self::FAIL_CLOSED, true)) {
                throw new ServiceUnavailableException(
                    'The store is briefly unable to process that. Please try again in a moment.',
                    'ICE-SYS-503',
                );
            }

            return $next($request);
        }

        if (!$outcome['allowed']) {
            throw new RateLimitException($outcome['retry_after']);
        }

        return $next($request)->withHeaders([
            'X-RateLimit-Limit' => (string) $outcome['limit'],
            'X-RateLimit-Remaining' => (string) $outcome['remaining'],
            'X-RateLimit-Reset' => (string) $outcome['reset_at'],
        ]);
    }
}
