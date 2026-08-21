<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Router;

/**
 * Runs early so every middleware after it can read the route's own metadata
 * (audience, permission, rate class, validation rules, idempotency flag).
 */
final class ResolveRoute implements Middleware
{
    public function __construct(private readonly Router $router)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        $match = $this->router->match($request->method, $request->path);

        $request->setAttribute('route_match', $match);
        $request->setAttribute('route', $match->route);
        $request->setAttribute('route_params', $match->params);

        return $next($request);
    }
}
