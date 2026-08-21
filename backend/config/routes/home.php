<?php

declare(strict_types=1);

use Iced\Controller\Customer\HomeController;
use Iced\Kernel\Route;

/**
 * The storefront's read of the home page.
 *
 * Public audience and the `catalog` rate-limit class: this is fetched by every
 * first visit to the site, signed in or not, and it is the same kind of traffic
 * as a product listing.
 */
return [
    [
        'method' => 'GET',
        'path' => '/home/hero',
        'handler' => [HomeController::class, 'hero'],
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'home.hero',
    ],
];
