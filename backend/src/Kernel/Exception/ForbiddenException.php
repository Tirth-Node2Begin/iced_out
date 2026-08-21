<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class ForbiddenException extends ApiException
{
    public function __construct(string $message = 'You do not have access to that.', string $code = 'ICE-AUTH-403')
    {
        parent::__construct(403, $code, $message);
    }
}
