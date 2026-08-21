<?php

declare(strict_types=1);

use Iced\Support\Env;

return [
    'host' => Env::string('DB_HOST', '127.0.0.1'),
    'port' => Env::int('DB_PORT', 3306),
    'name' => Env::string('DB_NAME', 'iced_out'),
    'user' => Env::string('DB_USER', 'root'),
    'password' => Env::string('DB_PASS'),
    'redis_url' => Env::string('REDIS_URL'),
];
