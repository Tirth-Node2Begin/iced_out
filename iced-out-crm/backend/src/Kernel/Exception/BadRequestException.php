<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class BadRequestException extends ApiException
{
    public function __construct(string $message = 'That request could not be read.', string $code = 'ICE-REQ-400')
    {
        parent::__construct(400, $code, $message);
    }
}
