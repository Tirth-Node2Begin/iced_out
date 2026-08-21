<?php

declare(strict_types=1);

/**
 * Shared boot for every file under api/. Each endpoint file requires this, then
 * calls Endpoint::serve() with the name(s) of the route it answers.
 */

// expose_php=Off is the deployment setting; this covers dev servers that leak it.
header_remove('X-Powered-By');

require dirname(__DIR__) . '/autoload.php';

class_exists(Iced\Kernel\Endpoint::class);
