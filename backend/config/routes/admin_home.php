<?php

declare(strict_types=1);

use Iced\Controller\Console\HomeHeroController;
use Iced\Kernel\Route;

/**
 * The console's home-page screen — the hero's running order of garments.
 *
 * Guarded by `cms.manage`: this is page composition, not catalogue work.
 * Someone allowed to edit a product's price has not thereby been allowed to
 * decide what the front page of the shop shows. ADMIN holds the `*` wildcard so
 * the new code needs no backfill (see `seeds/0001_roles_permissions.php`).
 *
 * Every verb answers with the WHOLE board rather than the row it touched — see
 * `HomeHeroController::board` for why.
 */
return [
    [
        'method' => 'GET', 'path' => '/admin/home/hero',
        'handler' => [HomeHeroController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'cms.manage',
        'rate_limit' => 'console_read', 'name' => 'admin.home.hero.index',
    ],
    [
        'method' => 'POST', 'path' => '/admin/home/hero',
        'handler' => [HomeHeroController::class, 'create'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'cms.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.home.hero.create',
        'rules' => [
            // Where the frame comes from: the catalogue, or a file. Absent
            // means "upload", which is the shape this endpoint had before the
            // product source existed.
            'source' => 'string|in:upload,product',
            // The id (or URL) returned by POST /admin/media. Not `required`
            // here because it is only required for `source: upload`, and a
            // route rule cannot see the other field — the controller enforces
            // the pairing and names the missing half.
            'image' => 'string|max:190',
            // A product slug. Optional for an upload — a slide can be a look
            // with nothing to buy behind it yet — and required for `product`.
            'product' => 'nullable|string|max:80',
            'alt' => 'string|max:190',
            'active' => 'bool',
        ],
    ],
    [
        'method' => 'PATCH', 'path' => '/admin/home/hero/{slide}',
        'handler' => [HomeHeroController::class, 'update'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'cms.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.home.hero.update',
        'rules' => [
            'source' => 'string|in:upload,product',
            'image' => 'string|max:190',
            'product' => 'nullable|string|max:80',
            'alt' => 'string|max:190',
            'active' => 'bool',
        ],
    ],
    [
        'method' => 'DELETE', 'path' => '/admin/home/hero/{slide}',
        'handler' => [HomeHeroController::class, 'destroy'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'cms.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.home.hero.delete',
    ],
    [
        'method' => 'POST', 'path' => '/admin/home/hero/{slide}/cutout',
        'handler' => [HomeHeroController::class, 'cutout'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'cms.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.home.hero.cutout',
    ],
    [
        /* A literal fourth segment beside `{slide}`, which is safe because the
           router compares literals before it binds placeholders — and because
           no other verb on this table is a POST to a three-segment hero path. */
        'method' => 'POST', 'path' => '/admin/home/hero/order',
        'handler' => [HomeHeroController::class, 'reorder'],
        'audience' => Route::AUDIENCE_STAFF, 'permission' => 'cms.manage',
        'rate_limit' => 'console_write', 'name' => 'admin.home.hero.reorder',
        'rules' => [
            'order' => 'required|array|min:1|max:12',
        ],
    ],
];
