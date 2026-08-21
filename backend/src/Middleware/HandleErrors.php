<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Exception\RateLimitException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Logger;
use PDOException;
use Throwable;

/**
 * Turns a thrown failure into the failure envelope of spec §4.3 — and does it
 * from INSIDE the pipeline, which is the whole point of this class.
 *
 * A `throw` unwinds every frame above it, so a middleware whose work happens
 * after `$next($request)` never runs. When errors were converted outside the
 * pipeline, that meant a 401 came back with no CORS headers and no security
 * headers: the browser refused to let the app read it, and a signed-out visitor
 * saw "the request could not be completed" instead of being asked to sign in.
 *
 * Placed BELOW SecurityHeaders and Cors and ABOVE everything that can throw, so
 * the response it builds travels back out through both of them and is decorated
 * exactly like a successful one. An error response is still a response.
 */
final class HandleErrors implements Middleware
{
    public function __construct(private readonly Logger $logger)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        try {
            return $next($request);
        } catch (ApiException $error) {
            $response = Response::envelope($error->toEnvelope(), $error->status());

            if ($error instanceof RateLimitException) {
                $response = $response->withHeader('Retry-After', (string) $error->retryAfter);
            }

            return $response;
        } catch (Throwable $error) {
            // The trace goes to the log and nowhere else (spec §14): the client
            // gets a request id to quote and nothing about our file layout.
            $this->logger->exception($error, [
                'request_id' => $request->requestId(),
                'path' => $request->path,
                'method' => $request->method,
            ]);

            // A database that is not answering is not a bug in this request —
            // it is the store being briefly down, and saying so tells the
            // client it is worth retrying. Anything else is genuinely ours.
            if ($this->isDatabaseDown($error)) {
                return Response::envelope([
                    'error' => [
                        'code' => 'ICE-SYS-503',
                        'message' => 'The store is briefly unavailable. Please try again in a moment.',
                        'retryable' => true,
                    ],
                ], 503);
            }

            return Response::envelope([
                'error' => [
                    'code' => 'ICE-SYS-500',
                    'message' => 'Something went wrong on our side. Quote the request id if you contact support.',
                    'retryable' => false,
                ],
            ], 500);
        }
    }

    /** SQLSTATE HY000/08xxx with a connection driver code — the server is unreachable. */
    private function isDatabaseDown(Throwable $error): bool
    {
        if (!$error instanceof PDOException) {
            return false;
        }

        $driverCode = (int) ($error->errorInfo[1] ?? 0);

        // 2002 cannot connect, 2003 no route, 2006 server gone away, 2013 lost.
        return in_array($driverCode, [2002, 2003, 2006, 2013], true)
            || str_starts_with((string) $error->getCode(), '08');
    }
}
