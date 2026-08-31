<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Uuid;

/**
 * Echoes the frontend's X-Request-Id into meta.request_id and every log line
 * (spec §4.2). A missing or malformed header gets a server-minted UUID so the
 * support handle always exists.
 */
final class RequestId implements Middleware
{
    public function handle(Request $request, callable $next): Response
    {
        $incoming = $request->header('x-request-id');
        $request->setAttribute('request_id', Uuid::isValid($incoming) ? $incoming : Uuid::v4());

        return $next($request);
    }
}
