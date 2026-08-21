<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

use RuntimeException;
use Throwable;

/**
 * Base of every failure the client is allowed to see. Carries exactly the
 * failure envelope of spec §4.3: code, message, retryable, errors[].
 */
class ApiException extends RuntimeException
{
    /** @param list<array{field?: string, detail: string}> $errors */
    public function __construct(
        private readonly int $status,
        private readonly string $errorCode,
        string $message,
        private readonly array $errors = [],
        private readonly bool $retryable = false,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $status, $previous);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    /** @return list<array{field?: string, detail: string}> */
    public function errors(): array
    {
        return $this->errors;
    }

    public function retryable(): bool
    {
        return $this->retryable;
    }

    /** @return array<string, mixed> */
    public function toEnvelope(): array
    {
        $error = [
            'code' => $this->errorCode,
            'message' => $this->getMessage(),
            'retryable' => $this->retryable,
        ];

        if ($this->errors !== []) {
            $error['errors'] = $this->errors;
        }

        return ['error' => $error];
    }
}
