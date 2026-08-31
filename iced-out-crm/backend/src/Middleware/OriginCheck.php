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

        if (!in_array($origin, $this->trustedOrigins(), true)) {
            throw new ForbiddenException('This request came from an untrusted origin.');
        }

        return $next($request);
    }

    /** @return list<string> */
    private function trustedOrigins(): array
    {
        /** @var list<string> $allowed */
        $allowed = $this->config->array('app.cors_allowed_origins');
        $appUrl = $this->config->string('app.url');

        if ($appUrl !== '') {
            $scheme = parse_url($appUrl, PHP_URL_SCHEME);
            $host = parse_url($appUrl, PHP_URL_HOST);
            $port = parse_url($appUrl, PHP_URL_PORT);

            if (is_string($scheme) && is_string($host)) {
                $allowed[] = $scheme . '://' . $host . (is_int($port) ? ':' . $port : '');
            }
        }

        return array_values(array_unique($allowed));
    }
}
