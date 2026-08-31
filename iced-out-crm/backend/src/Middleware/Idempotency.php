<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;
use Iced\Support\Json;

/**
 * Spec §4.6. Same key + same body ⇒ the stored response is replayed
 * byte-for-byte. Same key + different body ⇒ 409 ICE-IDMP-409. TTL 48 h.
 */
final class Idempotency implements Middleware
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');

        if (!$route instanceof Route || !$route->idempotent) {
            return $next($request);
        }

        $key = $request->header('idempotency-key');

        if ($key === '') {
            throw ValidationException::field(
                'Idempotency-Key',
                'This action requires an Idempotency-Key header.',
                'ICE-IDMP-422',
            );
        }

        $principal = $request->attribute('principal');
        $scope = $principal instanceof Principal ? $principal->audience . ':' . $principal->publicId : 'anon:' . $request->ip;
        $endpoint = $route->method . ' ' . $route->path;
        $keyHash = hash('sha256', $key, true);
        $requestHash = hash('sha256', $request->rawBody, true);

        $existing = $this->db->selectOne(
            'SELECT request_hash, response_status, response_body
               FROM idempotency_keys
              WHERE scope = ? AND endpoint = ? AND key_hash = ? AND expires_at > ?
              LIMIT 1',
            [$scope, $endpoint, $keyHash, $this->clock->nowString()],
        );

        if ($existing !== null) {
            if ((string) $existing['request_hash'] !== $requestHash) {
                throw new ConflictException(
                    'ICE-IDMP-409',
                    'That idempotency key was already used with a different request.',
                );
            }

            $replay = Json::decodeArray((string) $existing['response_body']);

            return Response::envelope(
                is_array($replay) ? $replay : ['data' => null],
                (int) $existing['response_status'],
            )->withHeader('Idempotent-Replay', 'true');
        }

        $response = $next($request);

        if ($response->status() < 400) {
            $envelope = $response->envelopeArray();

            $this->db->statement(
                'INSERT INTO idempotency_keys
                    (scope, endpoint, key_hash, request_hash, response_status, response_body, expires_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE response_status = VALUES(response_status)',
                [
                    $scope,
                    $endpoint,
                    $keyHash,
                    $requestHash,
                    $response->status(),
                    $envelope === null ? '' : Json::encode($envelope),
                    $this->clock->addSeconds($this->settings->int('security.idempotency_ttl_hours', 48) * 3600)
                        ->format(Clock::STORAGE_FORMAT),
                    $this->clock->nowString(),
                ],
            );
        }

        return $response;
    }
}
