<?php

declare(strict_types=1);

namespace Iced\Kernel;

/**
 * The ordered pipeline of spec §2.3. Built once per request from class names so
 * middleware that is never reached (e.g. Idempotency on a GET) is never built.
 */
final class Pipeline
{
    /** @param list<class-string<Middleware>> $middleware */
    public function __construct(
        private readonly Container $container,
        private readonly array $middleware,
    ) {
    }

    /** @param callable(Request): Response $destination */
    public function run(Request $request, callable $destination): Response
    {
        $chain = array_reduce(
            array_reverse($this->middleware),
            function (callable $next, string $class): callable {
                return function (Request $request) use ($next, $class): Response {
                    $middleware = $this->container->make($class);

                    if (!$middleware instanceof Middleware) {
                        return $next($request);
                    }

                    return $middleware->handle($request, $next);
                };
            },
            $destination,
        );

        return $chain($request);
    }
}
