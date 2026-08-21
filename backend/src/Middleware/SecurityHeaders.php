<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Config;

/** Spec §14 header set. API responses are JSON, so the CSP is default-src 'none'. */
final class SecurityHeaders implements Middleware
{
    public function __construct(private readonly Config $config)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        $response = $next($request);

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
        ];

        if (str_starts_with($this->config->string('app.url'), 'https://')) {
            $headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
        }

        // The rules above are not negotiable. Caching is: JSON must not be
        // stored, but a content-addressed image is immutable and says so.
        return $response->withHeaders($headers)->withDefaultHeader('Cache-Control', 'no-store');
    }
}
