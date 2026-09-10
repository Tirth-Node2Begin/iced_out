<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Service\Cart\CartService;

/**
 * Spec §8.8 — the bag.
 *
 * The endpoint set that makes one account's bag ONE BAG. Until this existed the
 * storefront kept it in `localStorage` and the phone kept it in a Hive box, so
 * signing into the same account twice gave you two bags that could not see each
 * other; the shared register they both read is `carts`/`cart_items`, and every
 * decision about what may go in it is `CartService`'s.
 *
 * Every verb returns the WHOLE bag, never just the line that changed. A client
 * that had to re-read after writing would spend a round trip finding out what
 * it had already been told, and — worse — would have a window in which its
 * screen and the server disagreed.
 *
 * `DELETE` reads its fields from the body OR the query string. A body on DELETE
 * is legal and is what the spec describes, but enough HTTP clients drop it
 * silently that refusing the query-string form would strand them with no way to
 * remove a line.
 */
final class CartController
{
    public function __construct(private readonly CartService $cart)
    {
    }

    /** #42 GET /me/cart */
    public function show(Request $request): Response
    {
        return Response::data($this->cart->show($this->principal($request)->userId));
    }

    /** #43 POST /me/cart/items — `{ productId, size, quantity = 1 }` */
    public function add(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        return Response::data($this->cart->add(
            $principal->userId,
            (string) $input['productId'],
            (string) $input['size'],
            isset($input['quantity']) ? (int) $input['quantity'] : 1,
        ));
    }

    /** #44 PATCH /me/cart/items — `{ productId, size, quantity }`; 0 removes. */
    public function update(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        return Response::data($this->cart->setQuantity(
            $principal->userId,
            (string) $input['productId'],
            (string) $input['size'],
            (int) $input['quantity'],
        ));
    }

    /** #45 DELETE /me/cart/items — `{ productId, size }` */
    public function remove(Request $request): Response
    {
        $principal = $this->principal($request);

        return Response::data($this->cart->remove(
            $principal->userId,
            $this->required($request, 'productId'),
            $this->required($request, 'size'),
        ));
    }

    /** #46 DELETE /me/cart */
    public function clear(Request $request): Response
    {
        return Response::data($this->cart->clear($this->principal($request)->userId));
    }

    /** #47 POST /me/cart/coupon — `{ code }` */
    public function applyCoupon(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{code: string} $input */
        $input = $request->validated();

        return Response::data($this->cart->applyCoupon($principal->userId, $input['code']));
    }

    /** #48 DELETE /me/cart/coupon */
    public function clearCoupon(Request $request): Response
    {
        return Response::data($this->cart->clearCoupon($this->principal($request)->userId));
    }

    /**
     * POST /me/cart/merge — `{ lines: [{ productId, size, quantity }] }`
     *
     * The other half of the spec's "guests have no server cart" rule (§8.8):
     * the device keeps the guest bag, and signing in hands it over here. Without
     * this endpoint a shopper who filled a bag and then signed in would watch it
     * empty itself, which is the exact behaviour the rule exists to avoid.
     *
     * Idempotent in the way that matters — the merge is summed and then clamped
     * to the per-order cap, so a client that retries after a dropped connection
     * cannot walk a line upwards forever.
     */
    public function merge(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{lines?: list<mixed>} $input */
        $input = $request->validated();

        /** @var list<mixed> $raw */
        $raw = is_array($input['lines'] ?? null) ? $input['lines'] : [];
        $lines = [];

        foreach ($raw as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $lines[] = [
                'productId' => (string) ($entry['productId'] ?? ''),
                'size' => (string) ($entry['size'] ?? ''),
                'quantity' => (int) ($entry['quantity'] ?? 0),
            ];
        }

        return Response::data($this->cart->merge($principal->userId, $lines));
    }

    /**
     * A field from the validated body, falling back to the query string.
     *
     * The route's own rules mark these optional precisely so this fallback can
     * exist: declared `required`, a DELETE whose client dropped the body would
     * be refused by the validator before the query string was ever looked at.
     */
    private function required(Request $request, string $field): string
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();
        $value = trim((string) ($input[$field] ?? $request->queryString($field)));

        if ($value === '') {
            throw ValidationException::field($field, 'This field is required.', 'ICE-CART-422');
        }

        return $value;
    }

    private function principal(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException();
        }

        return $principal;
    }
}
