<?php

declare(strict_types=1);

namespace Iced\Kernel;

interface Middleware
{
    /** @param callable(Request): Response $next */
    public function handle(Request $request, callable $next): Response;
}
