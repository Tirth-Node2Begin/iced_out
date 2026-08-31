<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Exception\ForbiddenException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Service\Auth\SessionManager;

/**
 * Audience first, then identity (spec §5.1): the X-Client-Audience header must
 * match the route's own class before any cookie is even looked at, so a staff
 * cookie can never be replayed against a customer route.
 */
final class Authenticate implements Middleware
{
    /** X-Client-Audience values → internal audience names. */
    private const HEADER_MAP = [
        'public' => Route::AUDIENCE_PUBLIC,
        'customer' => Route::AUDIENCE_CUSTOMER,
        'admin' => Route::AUDIENCE_STAFF,
    ];

    public function __construct(private readonly SessionManager $sessions)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');

        if (!$route instanceof Route) {
            return $next($request);
        }

        $declared = self::HEADER_MAP[strtolower($request->header('x-client-audience'))] ?? null;

        if ($route->audience !== Route::AUDIENCE_PUBLIC && $declared !== $route->audience) {
            throw new ForbiddenException('This endpoint is not available to that client.');
        }

        if ($route->audience === Route::AUDIENCE_PUBLIC) {
            // Public routes may still be called by a signed-in browser; resolving
            // the principal is best-effort and never a failure.
            if ($declared !== null && $declared !== Route::AUDIENCE_PUBLIC) {
                $principal = $this->sessions->resolve($request, $declared);

                if ($principal !== null) {
                    $request->setAttribute('principal', $principal);
                }
            }

            return $next($request);
        }

        $principal = $this->sessions->resolve($request, $route->audience);

        if ($principal === null) {
            throw new UnauthorizedException(
                $route->audience === Route::AUDIENCE_STAFF
                    ? 'Your console session has expired. Please sign in again.'
                    : 'Please sign in to continue.',
            );
        }

        $request->setAttribute('principal', $principal);

        return $next($request);
    }
}
