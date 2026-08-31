<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\RateLimitException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Support\Config;
use Iced\Support\RateLimiter;

/** Second half of spec §4.7 — session-scoped buckets (cart, console reads/writes). */
final class RateLimitByPrincipal implements Middleware
{
    public function __construct(
        private readonly RateLimiter $limiter,
        private readonly Config $config,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');
        $class = $route instanceof Route ? $route->rateLimit : 'default';
        /** @var array{limit?: int, window?: int, scope?: string} $rule */
        $rule = $this->config->array('app.rate_limits.' . $class);

        $scope = is_string($rule['scope'] ?? null) ? $rule['scope'] : 'ip';

        if (!in_array($scope, ['principal', 'both'], true)) {
            return $next($request);
        }

        $principal = $request->attribute('principal');
        $identity = $principal instanceof Principal
            ? $principal->audience . ':' . $principal->publicId
            : 'anon:' . $request->ip;

        $limit = (int) ($rule['limit'] ?? 120);
        $window = (int) ($rule['window'] ?? 60);
        $outcome = $this->limiter->consume(sprintf('rl:principal:%s:%s', $class, $identity), $limit, $window);

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
