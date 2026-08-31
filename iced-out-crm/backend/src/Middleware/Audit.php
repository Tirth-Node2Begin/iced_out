<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Support\Clock;
use Iced\Support\Json;
use Iced\Support\Logger;
use Throwable;

/**
 * Spec §14: every console mutation writes an audit row (actor, permission,
 * before/after, request_id). Controllers publish the before/after pair through
 * the `audit_before` / `audit_after` request attributes; the row is written
 * either way so the action itself is never invisible.
 */
final class Audit implements Middleware
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly Logger $logger,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');

        if (!$route instanceof Route || !$route->audit) {
            return $next($request);
        }

        $response = $next($request);

        if ($response->status() >= 400) {
            return $response;
        }

        $principal = $request->attribute('principal');
        $permission = $request->attribute('permission_used');
        $before = $request->attribute('audit_before');
        $after = $request->attribute('audit_after');

        try {
            $this->db->statement(
                'INSERT INTO audit_logs
                    (actor_id, actor_role, permission_used, action, entity_type, entity_id,
                     before_json, after_json, request_id, ip, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $principal instanceof Principal ? $principal->userId : null,
                    $principal instanceof Principal ? ($principal->role ?? '') : '',
                    is_string($permission) ? $permission : '',
                    $route->name ?? ($route->method . ' ' . $route->path),
                    (string) $request->attribute('audit_entity_type', ''),
                    (string) $request->attribute('audit_entity_id', ''),
                    $before === null ? null : Json::encode($before),
                    $after === null ? null : Json::encode($after),
                    $request->requestId(),
                    $request->ip,
                    $this->clock->nowString(),
                ],
            );
        } catch (Throwable $error) {
            // An audit failure must never swallow a successful mutation — log and move on.
            $this->logger->exception($error, ['request_id' => $request->requestId(), 'stage' => 'audit']);
        }

        return $response;
    }
}
