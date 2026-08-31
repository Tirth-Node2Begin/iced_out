<?php

declare(strict_types=1);

/**
 * Front controller.
 *
 * The named endpoint files beside this one are the readable map of the API, and
 * they are what you open to see how a given endpoint is wired. This file is the
 * dispatcher the web server falls back to for any path an endpoint file cannot
 * be reached at directly — chiefly parameterised paths such as
 * /api/v1/orders/ord-local-07, where there is no literal file to match.
 *
 * Both routes lead to the same table (config/routes/) and the same pipeline.
 */

use Iced\Kernel\Application;

header_remove('X-Powered-By');

$root = dirname(__DIR__);

require $root . '/autoload.php';

Application::boot($root)->run();
