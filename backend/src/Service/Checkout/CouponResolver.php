<?php

declare(strict_types=1);

namespace Iced\Service\Checkout;

use Iced\Domain\Money;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ValidationException;

/**
 * What a promotional code is worth, and whether it may be used at all.
 *
 * One class rather than two because the bag and the order have to agree. The
 * cart quotes a discount while the shopper is still shopping; `PlaceOrderService`
 * recomputes it at the moment money moves. If those two carried their own copy
 * of the rule, the day they drifted apart is the day a shopper is charged a
 * different number from the one the page promised — and the checkout's own
 * `crossCheckMoney` would refuse the order rather than explain why.
 *
 * VOUCHERS ARE NOT COUPONS HERE, and the refusal says so. Store credit became a
 * wallet balance in migration 0026 precisely because being spent through the
 * coupon slot destroyed the unspent remainder; a voucher code typed into the
 * coupon field is therefore turned away with the sentence that points at the
 * wallet instead.
 */
final class CouponResolver
{
    public function __construct(private readonly Database $db)
    {
    }

    /**
     * A code the shopper has just typed, or a refusal they can read.
     *
     * The minimum is checked HERE rather than after the fact — parity with the
     * storefront's `redeemCoupon` — so a code that cannot do anything yet is
     * refused with the figure it is waiting for, instead of being accepted and
     * then quietly discounting nothing.
     *
     * @return array<string, mixed> the coupon row
     *
     * @throws ValidationException
     */
    public function require(string $code, Money $subtotal): array
    {
        $coupon = $this->find($code);

        if ($coupon === null) {
            throw $this->refusal($code);
        }

        $minimum = Money::fromDecimalString((string) $coupon['min_subtotal']);

        if ($minimum->isGreaterThan($subtotal)) {
            throw ValidationException::field(
                'couponCode',
                sprintf('%s needs a subtotal of ₹%s.', $code, number_format($minimum->rupees())),
                'ICE-CPN-422',
            );
        }

        return $coupon;
    }

    /**
     * What a code STORED on a cart is worth right now.
     *
     * Deliberately does not throw. A bag carries its code between page loads
     * and between devices, and by the time it is read again the promotion may
     * have been withdrawn or the bag may have dropped back under the minimum.
     * Neither is the shopper doing something wrong, so the cart stops quoting
     * the discount instead of failing — the same rule the storefront applies to
     * a product that has left the catalogue.
     *
     * The two "not discounting" cases are NOT the same thing, which is why the
     * verdict has a second field:
     *
     *   withdrawn      → coupon null, pending null. There is nothing to say.
     *   under minimum  → coupon null, pending the sentence to show under the
     *                    field, so the bag can tell a shopper what it is
     *                    waiting for rather than looking broken.
     *
     * @return array{coupon: array<string, mixed>|null, pending: string|null}
     */
    public function forCart(?string $code, Money $subtotal): array
    {
        if ($code === null || trim($code) === '') {
            return ['coupon' => null, 'pending' => null];
        }

        $coupon = $this->find($code);

        if ($coupon === null) {
            return ['coupon' => null, 'pending' => null];
        }

        $minimum = Money::fromDecimalString((string) $coupon['min_subtotal']);

        if ($minimum->isGreaterThan($subtotal)) {
            return [
                'coupon' => null,
                'pending' => sprintf(
                    '%s needs a subtotal of ₹%s.',
                    (string) $coupon['code'],
                    number_format($minimum->rupees()),
                ),
            ];
        }

        return ['coupon' => $coupon, 'pending' => null];
    }

    /**
     * Clamped to the subtotal, so a flat-amount code can never drive a bag
     * negative, and rounded to whole rupees on the percent side.
     *
     * WHOLE RUPEES IS NOT COSMETIC. Every amount this application can charge is
     * a whole number of rupees, and a payment intent is matched against the
     * order total in paise, EXACTLY. A discount that lands on a fraction of a
     * rupee therefore produces a total the browser cannot have asked the gateway
     * for, and the shopper is charged and then told the payment failed. See
     * Money::percentRounded().
     *
     * @param array<string, mixed>|null $coupon
     */
    public function discountFor(?array $coupon, Money $subtotal): Money
    {
        if ($coupon === null) {
            return Money::fromRupees(0);
        }

        return (string) $coupon['kind'] === 'percent'
            ? $subtotal->percentRounded((int) (float) $coupon['value'])->clampTo($subtotal)
            : Money::fromDecimalString((string) $coupon['value'])->clampTo($subtotal);
    }

    /**
     * The shape the bag and the checkout summary render.
     *
     * @param array<string, mixed> $coupon
     *
     * @return array<string, mixed>
     */
    public function present(array $coupon): array
    {
        return [
            'code' => (string) $coupon['code'],
            'label' => (string) $coupon['label'],
            'kind' => (string) $coupon['kind'],
            'value' => (string) $coupon['kind'] === 'percent'
                ? (int) (float) $coupon['value']
                : Money::fromDecimalString((string) $coupon['value'])->rupees(),
            'minSubtotal' => Money::fromDecimalString((string) $coupon['min_subtotal'])->rupees(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function find(string $code): ?array
    {
        return $this->db->selectOne(
            'SELECT code, label, kind, value, min_subtotal FROM coupons WHERE code = ? AND active = 1',
            [strtoupper(trim($code))],
        );
    }

    /**
     * Why an unknown code was refused — and, when it is store credit, where it
     * actually goes.
     *
     * Accepting a voucher here used to be the bug the wallet exists to close:
     * the credit was clamped to the subtotal and then marked claimed in full,
     * so ₹4,600 spent on a ₹1,200 order destroyed ₹3,400 of the customer's
     * money. It also occupied the one coupon slot an order has, so taking your
     * own credit meant giving up any promotion.
     */
    private function refusal(string $code): ValidationException
    {
        $voucher = $this->db->selectOne(
            'SELECT claimed_on FROM vouchers WHERE code = ? LIMIT 1',
            [strtoupper(trim($code))],
        );

        if ($voucher === null) {
            return ValidationException::field(
                'couponCode',
                sprintf('%s is not a code we know.', $code),
                'ICE-CPN-422',
            );
        }

        return ValidationException::field(
            'couponCode',
            ($voucher['claimed_on'] ?? null) !== null
                ? sprintf('%s has already been added to your wallet.', $code)
                : sprintf('%s is store credit — add it to your wallet and it comes off at checkout.', $code),
            'ICE-CPN-422',
        );
    }
}
