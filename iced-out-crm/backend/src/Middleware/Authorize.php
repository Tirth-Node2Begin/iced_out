<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\ForbiddenException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;

/** RBAC gate (spec §5.5): the route names the permission code, the principal carries the resolved set. */
final class Authorize implements Middleware
{
    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');

        if (!$route instanceof Route || $route->permission === null) {
            return $next($request);
        }

        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal || !$principal->can($route->permission)) {
            throw new ForbiddenException('Your role does not allow that action.');
        }

        $request->setAttribute('permission_used', $route->permission);

        return $next($request);
    }
}
