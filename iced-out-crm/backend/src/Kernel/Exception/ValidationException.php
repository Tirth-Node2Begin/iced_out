<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class ValidationException extends ApiException
{
    /** @param list<array{field?: string, detail: string}> $errors */
    public function __construct(string $message, array $errors = [], string $code = 'ICE-REQ-422')
    {
        parent::__construct(422, $code, $message, $errors);
    }

    public static function field(string $field, string $detail, string $code = 'ICE-REQ-422', ?string $message = null): self
    {
        return new self($message ?? $detail, [['field' => $field, 'detail' => $detail]], $code);
    }
}
