<?php

declare(strict_types=1);

namespace Iced\Kernel\Exception;

/**
 * 404 bodies are deliberately neutral — they never confirm whether a record
 * exists but is out of reach (spec §4.4).
 */
final class NotFoundException extends ApiException
{
    public function __construct(string $code = 'ICE-SYS-404', string $message = 'We could not find that.')
    {
        parent::__construct(404, $code, $message);
    }
}
