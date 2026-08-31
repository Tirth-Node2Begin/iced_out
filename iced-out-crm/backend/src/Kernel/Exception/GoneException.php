<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

final class GoneException extends ApiException
{
    public function __construct(string $code = 'ICE-CHK-410', string $message = 'That checkout has expired. Please start again.')
    {
        parent::__construct(410, $code, $message);
    }
}
