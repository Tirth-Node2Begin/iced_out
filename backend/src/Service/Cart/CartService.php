<?php

declare(strict_types=1);

namespace Iced\Service\Cart;

use Iced\Domain\Money;
use Iced\Kernel\Exception\ValidationException;
use Iced\Presenter\CatalogPresenter;
use Iced\Repository\CartRepository;
use Iced\Repository\CatalogRepository;
use Iced\Service\Checkout\CouponResolver;
use Iced\Service\Settings\StoreSettings;

/**
 * The bag, server-side (spec §8.8).
 *
 * WHY THIS EXISTS. Both clients kept the bag entirely on the device: the
 * storefront in `localStorage["iced-out.bag"]`, the phone in a Hive box. Two
 * private stores with no third place either could look at, so the SAME ACCOUNT
 * signed in on a phone and on a laptop held two different bags and neither
 * could ever see the other's. Nothing was broken — the register was simply
 * never built. `carts` and `cart_items` have been sitting in the schema unread
 * since migration 0004.
 *
 * Three rules the whole file follows:
 *
 *   · PRICES ARE NEVER STORED IN THE BAG. `price_at_add` is kept as a record of
 *     what a line cost when it was picked up, and never quoted: every read
 *     re-prices from `products`. A bag that quotes last week's price is exactly
 *     what storing only ids was meant to prevent, and it is also what the
 *     checkout's own cross-check would refuse the order over.
 *   · A LINE IS (PRODUCT, SIZE). Not (product, size, colour) — a size already
 *     names a colour, because `uq_variants_live_size` is unique on
 *     (product_id, size) for every live variant. Colour is read back out of the
 *     variant, so a client that sends one and a client that does not still land
 *     on the same row. That is what makes the phone and the browser agree.
 *   · THE SERVER DECIDES THE QUANTITY. A client asks; `capFor` clamps against
 *     live stock, the variant's own per-order limit and the store setting. The
 *     answer always comes back in the payload, so a client that asked for four
 *     and got three is told rather than left quietly wrong.
 */
final class CartService
{
    /**
     * `cart_items` carries CHECK (quantity BETWEEN 1 AND 10). Clamping to it
     * here means an absurd request comes back as a clamped bag rather than as a
     * constraint violation the shopper reads as ICE-SYS-500.
     */
    private const HARD_MAX = 10;

    public function __construct(
        private readonly CartRepository $carts,
        private readonly CatalogRepository $catalog,
        private readonly CatalogPresenter $presenter,
        private readonly CouponResolver $coupons,
        private readonly StoreSettings $settings,
    ) {
    }

    /**
     * #42 GET /me/cart
     *
     * Reads the ACTIVE cart rather than opening one: a signed-in shopper who
     * has never added anything should not get a `carts` row written on every
     * page load just for asking.
     *
     * @return array<string, mixed>
     */
    public function show(int $userId): array
    {
        return $this->payload($this->carts->active($userId));
    }

    /**
     * #43 POST /me/cart/items — `quantity` is added to whatever is already there.
     *
     * ADDS rather than sets, because that is what "add to bag" means on both
     * clients: the storefront's `addItem` increments an existing line and the
     * phone's does the same. A client that wants to SET a figure has PATCH.
     *
     * @return array<string, mixed>
     */
    public function add(int $userId, string $slug, string $size, int $quantity): array
    {
        $variant = $this->requireVariant($slug, $size);
        $cartId = $this->carts->open($userId);

        $wanted = $this->carts->quantityOf($cartId, (int) $variant['product_id'], $size) + max(1, $quantity);

        $this->write($cartId, $variant, $wanted);

        return $this->payload($this->carts->active($userId));
    }

    /**
     * #44 PATCH /me/cart/items — sets the line to `quantity`; 0 removes it.
     *
     * @return array<string, mixed>
     */
    public function setQuantity(int $userId, string $slug, string $size, int $quantity): array
    {
        if ($quantity <= 0) {
            return $this->remove($userId, $slug, $size);
        }

        $variant = $this->requireVariant($slug, $size);
        $cartId = $this->carts->open($userId);

        $this->write($cartId, $variant, $quantity);

        return $this->payload($this->carts->active($userId));
    }

    /**
     * #45 DELETE /me/cart/items
     *
     * Removing something that is not there is a success, not a 404: two devices
     * can delete the same line, and the second one is still looking at the
     * outcome it asked for.
     *
     * @return array<string, mixed>
     */
    public function remove(int $userId, string $slug, string $size): array
    {
        $cart = $this->carts->active($userId);

        if ($cart === null) {
            return $this->payload(null);
        }

        if ($this->carts->removeLine((int) $cart['id'], $slug, $size) > 0) {
            $this->carts->touch((int) $cart['id']);
        }

        return $this->payload($this->carts->active($userId));
    }

    /**
     * #46 DELETE /me/cart — the bag AND its coupon.
     *
     * The code goes with the contents deliberately: a coupon left behind on an
     * empty bag reappears against the next thing the shopper picks up, which is
     * a promotion nobody applied.
     *
     * @return array<string, mixed>
     */
    public function clear(int $userId): array
    {
        $cart = $this->carts->active($userId);

        if ($cart !== null) {
            $this->carts->clear((int) $cart['id']);
            $this->carts->setCoupon((int) $cart['id'], null);
            $this->carts->touch((int) $cart['id']);
        }

        return $this->payload($this->carts->active($userId));
    }

    /**
     * #47 POST /me/cart/coupon — the code a shopper typed.
     *
     * Refused with the exact sentence the field shows (`CouponResolver`), and
     * refused BEFORE it is stored: a code that cannot apply must not be left
     * sitting on the bag looking accepted.
     *
     * @return array<string, mixed>
     */
    public function applyCoupon(int $userId, string $code): array
    {
        $cartId = $this->carts->open($userId);
        $subtotal = $this->subtotalOf($cartId);

        $coupon = $this->coupons->require($code, $subtotal);

        $this->carts->setCoupon($cartId, (string) $coupon['code']);
        $this->carts->touch($cartId);

        return $this->payload($this->carts->active($userId));
    }

    /**
     * #48 DELETE /me/cart/coupon
     *
     * @return array<string, mixed>
     */
    public function clearCoupon(int $userId): array
    {
        $cart = $this->carts->active($userId);

        if ($cart !== null) {
            $this->carts->setCoupon((int) $cart['id'], null);
            $this->carts->touch((int) $cart['id']);
        }

        return $this->payload($this->carts->active($userId));
    }

    /**
     * POST /me/cart/merge — the guest bag, folded into the account's.
     *
     * The spec's rule is that guests never get a server cart: the device keeps
     * the bag and SIGNING IN MERGES IT (§8.8). This is that merge, and it is the
     * endpoint that stops a shopper losing what they picked up before they had
     * an account.
     *
     * QUANTITIES ARE SUMMED per line rather than one side winning. Two devices
     * that both went offline both hold real intent, and a shopper who put two
     * in the bag on the phone and one on the laptop wants three — where "newest
     * device wins" would silently throw two of them away. The clamp then puts
     * the result back under the per-order cap, so summing can never produce a
     * bag that could not have been built by hand.
     *
     * Lines that no longer resolve are skipped rather than refused: a guest bag
     * can be weeks old, and one withdrawn product must not cost the shopper the
     * other four things in it.
     *
     * @param list<array{productId: string, size: string, quantity: int}> $lines
     *
     * @return array<string, mixed>
     */
    public function merge(int $userId, array $lines): array
    {
        if ($lines === []) {
            return $this->show($userId);
        }

        $cartId = $this->carts->open($userId);

        foreach ($lines as $line) {
            $slug = trim($line['productId']);
            $size = trim($line['size']);
            $quantity = (int) $line['quantity'];

            if ($slug === '' || $size === '' || $quantity < 1) {
                continue;
            }

            $variant = $this->carts->findVariant($slug, $size);

            if ($variant === null || !$this->isSellable($variant)) {
                continue;
            }

            $wanted = $this->carts->quantityOf($cartId, (int) $variant['product_id'], $size) + $quantity;
            $capped = $this->capFor($variant, $wanted);

            if ($capped < 1) {
                continue;
            }

            $this->carts->putLine(
                $cartId,
                (int) $variant['product_id'],
                (string) $variant['size'],
                $capped,
                (string) $variant['price'],
            );
        }

        $this->carts->touch($cartId);

        return $this->payload($this->carts->active($userId));
    }

    /* ------------------------------------------------------------- internals */

    /**
     * The variant a (slug, size) pair names, or the refusal a shopper reads.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private function requireVariant(string $slug, string $size): array
    {
        $variant = $this->carts->findVariant($slug, $size);

        if ($variant === null || !$this->isSellable($variant)) {
            throw ValidationException::field(
                'productId',
                sprintf('%s is no longer available in size %s.', $slug, $size),
                'ICE-CART-422',
            );
        }

        return $variant;
    }

    /** @param array<string, mixed> $variant */
    private function isSellable(array $variant): bool
    {
        return (string) $variant['product_status'] === 'Published'
            && (string) $variant['variant_status'] !== 'Archived';
    }

    /**
     * Writes the line at the clamped quantity, or refuses because there is none.
     *
     * @param array<string, mixed> $variant
     *
     * @throws ValidationException
     */
    private function write(int $cartId, array $variant, int $wanted): void
    {
        $quantity = $this->capFor($variant, $wanted);

        if ($quantity < 1) {
            throw ValidationException::field(
                'quantity',
                sprintf(
                    '%s is sold out in size %s.',
                    (string) $variant['product_name'],
                    (string) $variant['size'],
                ),
                'ICE-CART-422',
            );
        }

        $this->carts->putLine(
            $cartId,
            (int) $variant['product_id'],
            (string) $variant['size'],
            $quantity,
            (string) $variant['price'],
        );

        $this->carts->touch($cartId);
    }

    /**
     * How many of this variant the bag may hold.
     *
     * The lowest of four ceilings, and each is there for its own reason: what
     * is physically available, what the variant itself allows per order, the
     * store-wide setting, and the column's own CHECK. A bag is not a
     * reservation — stock is only ever held by `StockService` inside the
     * place-order transaction — so this is a courtesy clamp that keeps the
     * shopper out of a checkout that was always going to fail, not a promise.
     *
     * @param array<string, mixed> $variant
     */
    private function capFor(array $variant, int $wanted): int
    {
        $perVariant = (int) ($variant['max_per_order'] ?? 0);
        $ceiling = min(
            $perVariant > 0 ? $perVariant : self::HARD_MAX,
            $this->settings->int('inventory.max_per_order', 3),
            (int) $variant['available'],
            self::HARD_MAX,
        );

        return max(0, min($wanted, $ceiling));
    }

    private function subtotalOf(int $cartId): Money
    {
        $subtotal = Money::fromRupees(0);

        foreach ($this->liveLines($cartId)[0] as $row) {
            $subtotal = $subtotal->plus(
                Money::fromDecimalString((string) $row['price'])->times((int) $row['quantity']),
            );
        }

        return $subtotal;
    }

    /**
     * Splits the stored lines into the ones that still sell and the ones whose
     * catalogue row has GONE — and only the second kind is deleted.
     *
     * The distinction is the whole care taken here. A product an operator has
     * moved back to Draft for an afternoon is hidden from the bag but its line
     * is kept, so it comes back when the product does. A product that has been
     * deleted, or a variant archived, is never coming back, and leaving its row
     * behind would grow a dead cart that every future read has to step over.
     *
     * @return array{0: list<array<string, mixed>>, 1: list<int>}
     */
    private function liveLines(int $cartId): array
    {
        $live = [];
        $dead = [];

        foreach ($this->carts->lines($cartId) as $row) {
            $vanished = $row['variant_id'] === null
                || $row['product_deleted_at'] !== null
                || (string) $row['variant_status'] === 'Archived';

            if ($vanished) {
                $dead[] = (int) $row['id'];

                continue;
            }

            if ((string) $row['product_status'] !== 'Published') {
                continue;
            }

            $live[] = $row;
        }

        return [$live, $dead];
    }

    /**
     * The payload every endpoint in this file returns — spec §8.8 #42.
     *
     * One shape for all eight, so a client never has to re-read the bag after
     * writing to it and the two can never disagree about what just happened.
     *
     * @param array<string, mixed>|null $cart
     *
     * @return array<string, mixed>
     */
    private function payload(?array $cart): array
    {
        if ($cart === null) {
            return $this->emptyPayload(null, null);
        }

        [$rows, $dead] = $this->liveLines((int) $cart['id']);
        $this->carts->removeLinesById($dead);

        if ($rows === []) {
            return $this->emptyPayload($cart, null);
        }

        $products = $this->catalog->storefrontProductsBySlugs(
            array_map(static fn (array $row): string => (string) $row['product_slug'], $rows),
        );

        /* `array_values` matters: `$products` is keyed by slug, and a
           string-keyed array handed to PDO as positional bindings binds
           nothing. */
        $ids = array_values(array_map(static fn (array $row): int => (int) $row['id'], $products));
        $variants = $this->catalog->variantsForProducts($ids);
        $photos = $this->catalog->photosForProducts($ids);

        $lines = [];
        $subtotal = Money::fromRupees(0);
        $itemCount = 0;

        foreach ($rows as $row) {
            $slug = (string) $row['product_slug'];
            $product = $products[$slug] ?? null;

            /* Published a moment ago in `liveLines`, gone by the time the
               catalogue was asked. Vanishingly unlikely and cheap to survive —
               the alternative is a line rendering with no product behind it. */
            if ($product === null) {
                continue;
            }

            $quantity = (int) $row['quantity'];
            $unit = Money::fromDecimalString((string) $row['price']);
            $lineTotal = $unit->times($quantity);

            $subtotal = $subtotal->plus($lineTotal);
            $itemCount += $quantity;

            $lines[] = [
                'productId' => $slug,
                'size' => (string) $row['variant_size'],
                /* Read from the variant, never stored on the line. The phone's
                   bag line carries a colour and the browser's does not; both
                   get the same answer from here. */
                'color' => (string) $row['color'],
                'sku' => (string) $row['sku'],
                'quantity' => $quantity,
                'unitPrice' => $unit->rupees(),
                'lineTotal' => $lineTotal->rupees(),
                'available' => (int) $row['available'],
                'maxPerLine' => $this->capFor($row, self::HARD_MAX),
                'product' => $this->presenter->storefrontProduct(
                    $product,
                    $variants[(int) $product['id']] ?? [],
                    $photos[(int) $product['id']] ?? [],
                ),
            ];
        }

        $verdict = $this->coupons->forCart(
            $cart['coupon_code'] === null ? null : (string) $cart['coupon_code'],
            $subtotal,
        );

        $discount = $this->coupons->discountFor($verdict['coupon'], $subtotal);

        return [
            'lines' => $lines,
            'itemCount' => $itemCount,
            'subtotal' => $subtotal->rupees(),
            'coupon' => $verdict['coupon'] === null ? null : $this->coupons->present($verdict['coupon']),
            /* The code as STORED, even when it is not discounting. A client that
               only got `coupon: null` would clear the field the shopper typed. */
            'couponCode' => $cart['coupon_code'] === null ? null : (string) $cart['coupon_code'],
            'couponPending' => $verdict['pending'],
            'discount' => $discount->rupees(),
            'total' => $subtotal->minus($discount)->atLeastZero()->rupees(),
            'version' => (int) $cart['version'],
            'updatedAt' => (string) $cart['updated_at'],
        ];
    }

    /**
     * @param array<string, mixed>|null $cart
     *
     * @return array<string, mixed>
     */
    private function emptyPayload(?array $cart, ?string $pending): array
    {
        return [
            'lines' => [],
            'itemCount' => 0,
            'subtotal' => 0,
            'coupon' => null,
            'couponCode' => $cart === null || $cart['coupon_code'] === null ? null : (string) $cart['coupon_code'],
            'couponPending' => $pending,
            'discount' => 0,
            'total' => 0,
            'version' => $cart === null ? 0 : (int) $cart['version'],
            'updatedAt' => $cart === null ? null : (string) $cart['updated_at'],
        ];
    }
}
