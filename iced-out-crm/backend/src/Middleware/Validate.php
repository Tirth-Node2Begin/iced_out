<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Support\Validator;

/**
 * Shape-checks the request against the rules declared on the route, then hands
 * controllers a clean typed array via $request->validated().
 */
final class Validate implements Middleware
{
    public function __construct(private readonly Validator $validator)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');

        if (!$route instanceof Route || $route->rules === []) {
            return $next($request);
        }

        /** @var array<string, mixed> $input */
        $input = $request->isMutation() ? $request->body() : $request->query;

        $request->setAttribute('validated', $this->validator->validate($input, $route->rules));

        return $next($request);
    }
}
