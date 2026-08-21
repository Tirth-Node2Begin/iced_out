<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;

/** 1 MB for JSON, 8 MB for multipart media (spec §2.3). */
final class BodyLimit implements Middleware
{
    private const JSON_LIMIT = 1_048_576;
    private const MEDIA_LIMIT = 8_388_608;

    public function handle(Request $request, callable $next): Response
    {
        if (!$request->isMutation()) {
            return $next($request);
        }

        $isMultipart = str_contains($request->header('content-type'), 'multipart/form-data');
        $limit = $isMultipart ? self::MEDIA_LIMIT : self::JSON_LIMIT;
        $declared = (int) $request->header('content-length', '0');
        $actual = max($declared, strlen($request->rawBody));

        if ($actual > $limit) {
            throw new ApiException(413, 'ICE-REQ-413', 'That upload is too large.', [
                ['detail' => sprintf('Limit is %d KB for this endpoint.', intdiv($limit, 1024))],
            ]);
        }

        return $next($request);
    }
}
