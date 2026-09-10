<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Repository\CartRepository;

/**
 * Spec §8.7 — the saved list.
 *
 * The bag's quieter twin, and it had the same fault: saved items lived only in
 * the browser (and only on the phone), so the same account saw a different list
 * on each device. `wishlist_items` (migration 0030) is the shared register.
 *
 * IDS ARE OPAQUE AND STORED VERBATIM — the spec is explicit about it. The UI
 * saves real product slugs (`afterdark-hoodie`) AND the gender listing-tile ids
 * (`m01`…`w20`) that only `saved-items.ts` knows how to resolve. Validating
 * these against the products table would throw away half of what the UI legally
 * saves; resolution stays client-side, where an id that no longer means
 * anything is silently dropped.
 *
 * PUT is a FULL REPLACE, which is how the login merge is done: the client reads
 * the server list, unions it with what the device is holding, and puts the
 * result. Doing the union here instead would make it impossible to ever remove
 * anything.
 */
final class WishlistController
{
    /** Spec §8.7. A saved list is a shortlist; past this it is a second catalogue. */
    private const MAX_IDS = 200;

    /** `wishlist_items.product_ref` is VARCHAR(64). */
    private const MAX_ID_LENGTH = 64;

    public function __construct(private readonly CartRepository $carts)
    {
    }

    /** #38 GET /me/wishlist */
    public function show(Request $request): Response
    {
        return Response::data([
            'productIds' => $this->carts->wishlist($this->principal($request)->userId),
        ]);
    }

    /** #39 PUT /me/wishlist — `{ productIds }`, a full replace. */
    public function replace(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{productIds?: mixed} $input */
        $input = $request->validated();

        /** @var list<mixed> $raw */
        $raw = is_array($input['productIds'] ?? null) ? $input['productIds'] : [];
        $ids = [];

        foreach ($raw as $entry) {
            if (!is_string($entry)) {
                continue;
            }

            $id = trim($entry);

            /* Silently skipped rather than refused. A list is synced wholesale
               by a client that may be several versions old, and rejecting the
               whole PUT over one malformed id would lose the other forty. */
            if ($id === '' || mb_strlen($id) > self::MAX_ID_LENGTH || in_array($id, $ids, true)) {
                continue;
            }

            $ids[] = $id;

            if (count($ids) >= self::MAX_IDS) {
                break;
            }
        }

        $this->carts->replaceWishlist($principal->userId, $ids);

        return Response::data(['productIds' => $this->carts->wishlist($principal->userId)]);
    }

    /** #40 POST /me/wishlist/{productId} */
    public function add(Request $request): Response
    {
        $principal = $this->principal($request);
        $id = $this->productRef($request);
        $saved = $this->carts->wishlist($principal->userId);

        /* Already saved is a success, not an error: two devices can press the
           heart on the same piece, and the second one still got what it asked
           for. The cap is checked only when something new is going in. */
        if (!in_array($id, $saved, true)) {
            if (count($saved) >= self::MAX_IDS) {
                throw ValidationException::field(
                    'productId',
                    sprintf('Your saved list is full — it holds %d pieces.', self::MAX_IDS),
                    'ICE-WISH-422',
                );
            }

            $this->carts->saveWish($principal->userId, $id, $this->carts->nextWishPosition($principal->userId));
        }

        return Response::data(['productIds' => $this->carts->wishlist($principal->userId)]);
    }

    /** #41 DELETE /me/wishlist/{productId} */
    public function remove(Request $request): Response
    {
        $principal = $this->principal($request);

        $this->carts->forgetWish($principal->userId, $this->productRef($request));

        return Response::data(['productIds' => $this->carts->wishlist($principal->userId)]);
    }

    private function productRef(Request $request): string
    {
        $id = trim($request->routeParam('productId'));

        if ($id === '' || mb_strlen($id) > self::MAX_ID_LENGTH) {
            throw ValidationException::field('productId', 'That is not a saveable id.', 'ICE-WISH-422');
        }

        return $id;
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
