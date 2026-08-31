<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Config;

/**
 * Split-origin dev only (spec §3.2). In the single-origin production layout no
 * preflight ever fires and this middleware is inert.
 */
final class Cors implements Middleware
{
    private const ALLOWED_HEADERS = 'Content-Type, X-Client-Audience, X-Request-Id, X-Client-Timezone, Accept-Language, Idempotency-Key';
    private const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

    public function __construct(private readonly Config $config)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        $origin = $request->header('origin');
        /** @var list<string> $allowed */
        $allowed = $this->config->array('app.cors_allowed_origins');
        $isAllowed = $origin !== '' && in_array($origin, $allowed, true);

        if ($request->method === 'OPTIONS') {
            $preflight = Response::noContent();

            return $isAllowed ? $this->decorate($preflight, $origin) : $preflight;
        }

        $response = $next($request);

        return $isAllowed ? $this->decorate($response, $origin) : $response;
    }

    private function decorate(Response $response, string $origin): Response
    {
        return $response->withHeaders([
            'Access-Control-Allow-Origin' => $origin,
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Allow-Headers' => self::ALLOWED_HEADERS,
            'Access-Control-Allow-Methods' => self::ALLOWED_METHODS,
            'Access-Control-Expose-Headers' => 'X-Request-Id, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
            'Access-Control-Max-Age' => '600',
            'Vary' => 'Origin',
        ]);
    }
}
