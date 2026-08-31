<?php

declare(strict_types=1);

namespace Iced\Kernel;

use Iced\Kernel\Exception\BadRequestException;
use Iced\Support\Json;

/**
 * Immutable-ish view of the incoming HTTP request. `attributes` is the one
 * mutable slot: middleware writes findings there (request_id, principal,
 * validated payload) and controllers read them.
 */
final class Request
{
    /** @var array<string, mixed> */
    private array $attributes = [];

    /** @var array<array-key, mixed>|null */
    private ?array $decodedBody = null;

    /**
     * @param array<string, string>       $query
     * @param array<string, string>       $headers lowercase keys
     * @param array<string, string>       $cookies
     * @param array<string, mixed>        $files
     * @param array<string, mixed>        $server
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
        public readonly array $cookies,
        public readonly string $rawBody,
        public readonly string $ip,
        public readonly array $files = [],
        public readonly array $server = [],
    ) {
    }

    /**
     * @param string|null $forcedPath when the web server already decided which
     *        endpoint file serves this URL, the file states its own path rather
     *        than re-deriving it from REQUEST_URI (see Kernel\Endpoint).
     */
    public static function capture(string $basePath, ?string $forcedPath = null): self
    {
        /** @var array<string, mixed> $server */
        $server = $_SERVER;

        $method = strtoupper(is_string($server['REQUEST_METHOD'] ?? null) ? $server['REQUEST_METHOD'] : 'GET');
        $uri = is_string($server['REQUEST_URI'] ?? null) ? $server['REQUEST_URI'] : '/';
        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) ? $path : '/';

        if ($basePath !== '' && str_starts_with($path, $basePath)) {
            $path = substr($path, strlen($basePath));
        }

        $path = '/' . trim($path, '/');

        /** @var array<string, string> $query */
        $query = array_map(static fn (mixed $v): string => is_scalar($v) ? (string) $v : '', $_GET);

        /** @var array<string, string> $cookies */
        $cookies = array_map(static fn (mixed $v): string => is_scalar($v) ? (string) $v : '', $_COOKIE);

        $raw = file_get_contents('php://input');

        return new self(
            method: $method,
            path: $forcedPath ?? $path,
            query: $query,
            headers: self::readHeaders($server),
            cookies: $cookies,
            rawBody: $raw === false ? '' : $raw,
            ip: self::clientIp($server),
            files: $_FILES,
            server: $server,
        );
    }

    public function header(string $name, string $default = ''): string
    {
        return $this->headers[strtolower($name)] ?? $default;
    }

    public function cookie(string $name): ?string
    {
        return $this->cookies[$name] ?? null;
    }

    public function queryString(string $name, string $default = ''): string
    {
        $value = $this->query[$name] ?? '';

        return $value === '' ? $default : $value;
    }

    public function queryInt(string $name, int $default): int
    {
        $value = $this->query[$name] ?? '';

        return is_numeric($value) ? (int) $value : $default;
    }

    public function isMutation(): bool
    {
        return !in_array($this->method, ['GET', 'HEAD', 'OPTIONS'], true);
    }

    /**
     * @return array<array-key, mixed>
     *
     * @throws BadRequestException on malformed JSON
     */
    public function body(): array
    {
        if ($this->decodedBody !== null) {
            return $this->decodedBody;
        }

        if (str_contains($this->header('content-type'), 'multipart/form-data')) {
            /** @var array<array-key, mixed> $post */
            $post = $_POST;

            return $this->decodedBody = $post;
        }

        $decoded = Json::decodeArray($this->rawBody);

        if ($decoded === null) {
            throw new BadRequestException('That request body was not valid JSON.');
        }

        return $this->decodedBody = $decoded;
    }

    public function attribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }

    public function setAttribute(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function requestId(): string
    {
        $id = $this->attribute('request_id');

        return is_string($id) ? $id : '';
    }

    /** @return array<string, mixed> */
    public function validated(): array
    {
        $validated = $this->attribute('validated', []);

        return is_array($validated) ? $validated : [];
    }

    /** @return array<string, string> */
    public function routeParams(): array
    {
        $params = $this->attribute('route_params', []);

        /** @var array<string, string> $params */
        return is_array($params) ? $params : [];
    }

    public function routeParam(string $name, string $default = ''): string
    {
        return $this->routeParams()[$name] ?? $default;
    }

    /**
     * @param array<string, mixed> $server
     *
     * @return array<string, string>
     */
    private static function readHeaders(array $server): array
    {
        $headers = [];

        foreach ($server as $key => $value) {
            if (!is_string($value)) {
                continue;
            }

            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = $value;
            } elseif (in_array($key, ['CONTENT_TYPE', 'CONTENT_LENGTH'], true)) {
                $headers[strtolower(str_replace('_', '-', $key))] = $value;
            }
        }

        return $headers;
    }

    /** @param array<string, mixed> $server */
    private static function clientIp(array $server): string
    {
        $remote = $server['REMOTE_ADDR'] ?? '';

        return is_string($remote) ? $remote : '';
    }
}
