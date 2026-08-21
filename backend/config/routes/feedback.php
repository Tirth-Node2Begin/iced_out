<?php

declare(strict_types=1);

use Iced\Controller\Customer\FeedbackController;
use Iced\Controller\Customer\ReturnController;
use Iced\Kernel\Route;

/**
 * The customer's own half of reviews, support and returns.
 *
 * The console has had `/admin/reviews`, `/admin/support/queries` and
 * `/admin/returns` all along. These are the other end of all three — see
 * `FeedbackController` and `ReturnController` for why their absence is what kept
 * every one of those features reading a fixture or `localStorage`.
 */
return [
    /* -------------------------------------------------------------- reviews */
    [
        'method' => 'GET',
        'path' => '/reviews',
        'handler' => [FeedbackController::class, 'reviews'],
        // Public: a product page quotes its reviews to a visitor with no account.
        'audience' => Route::AUDIENCE_PUBLIC,
        'rate_limit' => 'catalog',
        'name' => 'reviews.index',
    ],
    [
        'method' => 'GET',
        'path' => '/me/reviews',
        'handler' => [FeedbackController::class, 'myReviews'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'me.reviews.index',
    ],
    [
        'method' => 'POST',
        'path' => '/me/reviews',
        'handler' => [FeedbackController::class, 'submitReview'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'rate_limit' => 'auth',
        'name' => 'me.reviews.create',
        /* No `customer` field. The byline is taken from the account — see the
           controller — so it cannot be supplied by whoever is posting. */
        'rules' => [
            'product' => 'required|string|max:160',
            'rating' => 'required|int|min:1|max:5',
            'headline' => 'required|string|min:3|max:160',
            'body' => 'string|max:4000',
            'fit' => 'string|max:40',
        ],
    ],

    /* -------------------------------------------------------------- support */
    [
        'method' => 'POST',
        'path' => '/support/queries',
        'handler' => [FeedbackController::class, 'submitQuery'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'rate_limit' => 'auth',
        'name' => 'support.queries.create',
        /* Neither `customer` nor `email`: both come from the account. The topic is
           checked against the settings vocabulary in the repository, not here — a
           route file is loaded before any database connection exists. */
        'rules' => [
            'topic' => 'required|string|max:60',
            'message' => 'required|string|min:4|max:4000',
            'order' => 'string|max:40',
        ],
    ],
    /* -------------------------------------------------------------- returns */
    [
        'method' => 'GET',
        'path' => '/me/returns',
        'handler' => [ReturnController::class, 'index'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'me.returns.index',
    ],
    [
        'method' => 'POST',
        'path' => '/me/returns',
        'handler' => [ReturnController::class, 'create'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'rate_limit' => 'auth',
        'name' => 'me.returns.create',
        /* No `amount`: what the return is worth is the line's own price, read from
           the order. A figure supplied here would let a shopper name their own
           refund. The reason and outcome are checked against the settings
           vocabularies in the controller, not here. */
        'rules' => [
            'order' => 'required|string|max:40',
            'item' => 'required|string|max:180',
            'reason' => 'required|string|max:160',
            'outcome' => 'required|string|max:40',
            'replacement' => 'string|max:180',
            'pickup' => 'string|max:60',
        ],
    ],

    [
        'method' => 'GET',
        'path' => '/me/support',
        'handler' => [FeedbackController::class, 'myQueries'],
        'audience' => Route::AUDIENCE_CUSTOMER,
        'name' => 'me.support.index',
    ],
];
