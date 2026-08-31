<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class ConflictException extends ApiException
{
    /** @param list<array{field?: string, detail: string}> $errors */
    public function __construct(string $code, string $message, array $errors = [], bool $retryable = false)
    {
        parent::__construct(409, $code, $message, $errors, $retryable);
    }
}
