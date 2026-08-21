<?php

declare(strict_types=1);

namespace Iced\Kernel;

use Iced\Support\Json;

/**
 * The envelope of spec §4.3 and nothing else. Controllers hand back
 * Response::data(...); meta.request_id is stamped centrally on the way out so
 * no handler has to remember it.
 */
final class Response
{
    /**
     * @param array<string, string> $headers
     * @param array<string, mixed>|null $envelope
     */
    private function __construct(
        private int $status,
        private array $headers,
        private ?array $envelope,
        private string $raw = '',
    ) {
    }

    /** @param array<string, mixed> $meta */
    public static function data(mixed $data, int $status = 200, array $meta = []): self
    {
        $envelope = ['data' => $data];

        if ($meta !== []) {
            $envelope['meta'] = $meta;
        }

        return new self($status, [], $envelope);
    }

    /**
     * @param list<mixed>          $items
     * @param array{page: int, per_page: int, total: int, total_pages: int} $pagination
     */
    public static function paginated(array $items, array $pagination): self
    {
        return self::data($items, 200, ['pagination' => $pagination]);
    }

    /** @param array<string, mixed> $envelope */
    public static function envelope(array $envelope, int $status): self
    {
        return new self($status, [], $envelope);
    }

    public static function noContent(): self
    {
        return new self(204, [], null);
    }

    /** @param array<string, string> $headers */
    public static function raw(string $body, string $contentType, int $status = 200, array $headers = []): self
    {
        return new self($status, $headers + ['Content-Type' => $contentType], null, $body);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function withStatus(int $status): self
    {
        $clone = clone $this;
        $clone->status = $status;

        return $clone;
    }

    public function withHeader(string $name, string $value): self
    {
        $clone = clone $this;
        $clone->headers[$name] = $value;

        return $clone;
    }

    /** @param array<string, string> $headers */
    public function withHeaders(array $headers): self
    {
        $clone = clone $this;
        $clone->headers = $headers + $clone->headers;

        return $clone;
    }

    /**
     * Sets a header only if the response has not already chosen one.
     *
     * For headers that are a sensible default rather than a rule — Cache-Control
     * is `no-store` for JSON, but a content-addressed image is immutable and
     * says so itself.
     */
    public function withDefaultHeader(string $name, string $value): self
    {
        if (isset($this->headers[$name])) {
            return $this;
        }

        return $this->withHeader($name, $value);
    }

    public function withMeta(string $key, mixed $value): self
    {
        if ($this->envelope === null) {
            return $this;
        }

        $clone = clone $this;
        /** @var array<string, mixed> $meta */
        $meta = is_array($clone->envelope['meta'] ?? null) ? $clone->envelope['meta'] : [];
        $meta[$key] = $value;
        $clone->envelope['meta'] = $meta;

        return $clone;
    }

    /** @return array<string, string> */
    public function headers(): array
    {
        return $this->headers;
    }

    /** @return array<string, mixed>|null */
    public function envelopeArray(): ?array
    {
        return $this->envelope;
    }

    public function body(): string
    {
        if ($this->envelope !== null) {
            return Json::encode($this->envelope);
        }

        return $this->raw;
    }

    public function send(): void
    {
        http_response_code($this->status);

        if ($this->envelope !== null && !isset($this->headers['Content-Type'])) {
            $this->headers['Content-Type'] = 'application/json; charset=utf-8';
        }

        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value, true);
        }

        if ($this->status === 204) {
            return;
        }

        echo $this->body();
    }
}
