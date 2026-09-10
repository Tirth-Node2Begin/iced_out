<?php

declare(strict_types=1);

use Iced\Controller\Customer\CartController;
use Iced\Controller\Customer\WishlistController;
use Iced\Kernel\Route;

/**
 * Spec §8.8 the cart (7) and §8.7 the wishlist (4), plus the merge the cart
 * rule implies.
 *
 * These are the routes that make one account's bag ONE bag. Everything a
 * shopper carries used to live only on the device that carried it — the
 * storefront in `localStorage`, the phone in a Hive box — so the same account
 * signed in twice held two bags and two saved lists, and neither copy could
 * ever see the other. The tables behind these routes have been in the schema
 * since migration 0004 (cart) and 0030 (wishlist); until now nothing read them.
 *
 * CUSTOMER AUDIENCE THROUGHOUT, and that is the spec's hard rule rather than an
 * oversight: guests have no server cart at all. A guest bag stays on the device
 * and is handed over at `me.cart.merge` the moment there is an account to hang
 * it on.
 *
 * The `cart` rate-limit bucket already existed in config/app.php waiting for
 * these — 30 writes a minute per customer. Reads sit on `default`, because
 * polling the bag to see what the other device did is a read and must not eat
 * the allowance for actually changing it.
 */

$read = static fn (string $path, array $handler, string $name): array => [
    'method' => 'GET',
    'path' => $path,
    'handler' => $handler,
    'audience' => Route::AUDIENCE_CUSTOMER,
    'name' => $name,
];

$write = static fn (string $verb, string $path, array $handler, string $name, array $rules = []): array => [
    'method' => $verb,
    'path' => $path,
    'handler' => $handler,
    'audience' => Route::AUDIENCE_CUSTOMER,
    'rate_limit' => 'cart',
    'name' => $name,
    'rules' => $rules,
];

/* A line is named by (product, size) — never by a cart-line id. Both clients
   already hold that pair and neither holds a server id, so keying on it is what
   lets the phone edit a line the browser created without a round trip to find
   out what the server called it.

   `max:8` on size is `product_variants.size`'s own width; `max:64` on productId
   is `products.public_id`'s. */
$lineRules = [
    'productId' => 'required|string|max:64',
    'size' => 'required|string|max:8',
];

return [
    $read('/me/cart', [CartController::class, 'show'], 'me.cart.show'),

    $write('POST', '/me/cart/items', [CartController::class, 'add'], 'me.cart.items.add', $lineRules + [
        // Absent means one, which is what "add to bag" does on both clients.
        // The ceiling here is the column's CHECK; the real clamp is stock and
        // the per-order cap, and CartService applies it.
        'quantity' => 'int|min:1|max:10',
    ]),

    $write('PATCH', '/me/cart/items', [CartController::class, 'update'], 'me.cart.items.update', $lineRules + [
        // Zero is legal and means "take this line out" (spec §8.8 #44), so the
        // stepper's last press down needs no second endpoint.
        'quantity' => 'required|int|min:0|max:10',
    ]),

    /* DELETE's fields are NOT `required` here on purpose. A body on DELETE is
       legal and is what the spec describes, but enough HTTP clients drop it
       that the controller also accepts the query-string form — and a `required`
       rule would refuse those requests before the controller ever looked. The
       controller enforces presence across both sources. */
    $write('DELETE', '/me/cart/items', [CartController::class, 'remove'], 'me.cart.items.remove', [
        'productId' => 'string|max:64',
        'size' => 'string|max:8',
    ]),

    $write('DELETE', '/me/cart', [CartController::class, 'clear'], 'me.cart.clear'),

    $write('POST', '/me/cart/coupon', [CartController::class, 'applyCoupon'], 'me.cart.coupon.apply', [
        'code' => 'required|string|min:3|max:40',
    ]),
    $write('DELETE', '/me/cart/coupon', [CartController::class, 'clearCoupon'], 'me.cart.coupon.clear'),

    /* The guest bag, handed over at sign-in. Quantities are SUMMED and then
       clamped — see CartService::merge for why summing beats letting one device
       win. */
    $write('POST', '/me/cart/merge', [CartController::class, 'merge'], 'me.cart.merge', [
        'lines' => 'required|array|max:100',
    ]),

    /* ------------------------------------------------------------ §8.7 saved */

    $read('/me/wishlist', [WishlistController::class, 'show'], 'me.wishlist.show'),
    $write('PUT', '/me/wishlist', [WishlistController::class, 'replace'], 'me.wishlist.replace', [
        // Opaque strings, stored verbatim — see WishlistController.
        'productIds' => 'required|array|max:200',
    ]),
    $write('POST', '/me/wishlist/{productId}', [WishlistController::class, 'add'], 'me.wishlist.add'),
    $write('DELETE', '/me/wishlist/{productId}', [WishlistController::class, 'remove'], 'me.wishlist.remove'),
];
