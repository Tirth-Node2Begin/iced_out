<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Exception\ServiceUnavailableException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Config;

final class Maintenance implements Middleware
{
    /** Health and readiness stay answerable while the store is down. */
    private const ALWAYS_OPEN = ['/health', '/ready', '/version'];

    public function __construct(private readonly Config $config)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        if ($this->config->bool('app.maintenance') && !in_array($request->path, self::ALWAYS_OPEN, true)) {
            throw new ServiceUnavailableException('The store is briefly down for maintenance. Please try again shortly.');
        }

        return $next($request);
    }
}
