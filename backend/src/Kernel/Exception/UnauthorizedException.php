<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class UnauthorizedException extends ApiException
{
    public function __construct(string $message = 'Please sign in to continue.')
    {
        parent::__construct(401, 'ICE-AUTH-401', $message);
    }
}
