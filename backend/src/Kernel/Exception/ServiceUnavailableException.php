<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class ServiceUnavailableException extends ApiException
{
    public function __construct(string $message = 'The store is briefly unavailable. Please try again in a moment.', string $code = 'ICE-SYS-503')
    {
        parent::__construct(503, $code, $message, [], true);
    }
}
