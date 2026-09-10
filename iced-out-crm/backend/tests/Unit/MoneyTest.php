<?php

declare(strict_types=1);

namespace Iced\Tests\Unit;

use Iced\Domain\Money;
use PHPUnit\Framework\TestCase;

final class MoneyTest extends TestCase
{
    public function testDecimalStringsRoundTripWithoutFloats(): void
    {
        $money = Money::fromDecimalString('17800.00');

        self::assertSame(1780000, $money->paise);
        self::assertSame(17800, $money->rupees());
        self::assertSame('17800.00', $money->toDecimalString());
    }

    public function testFractionalPaiseSurviveTheRoundTrip(): void
    {
        self::assertSame('0.05', Money::fromDecimalString('0.05')->toDecimalString());
        self::assertSame('1234.50', Money::fromDecimalString('1234.5')->toDecimalString());
    }

    /**
     * Percent discounts land on WHOLE RUPEES, rounded half-up.
     *
     * This used to assert 112515 paise — a discount of ₹1,125.15. That looked
     * harmless and was not: a sub-rupee total cannot be expressed as a gateway
     * amount, so once payment intents began matching the total in paise exactly,
     * any bag whose percentage did not divide evenly charged the shopper and
     * then recorded the order unpaid. The browser had always rounded to whole
     * rupees; the server now agrees with it.
     */
    public function testPercentDiscountsLandOnWholeRupees(): void
    {
        // 15% of ₹7,501 is ₹1,125.15 → ₹1,125.
        self::assertSame(112500, Money::fromRupees(7501)->percentRounded(15)->paise);

        // Half-up, matching the browser's Math.round: 10% of ₹7,999 is ₹799.90 → ₹800.
        self::assertSame(80000, Money::fromRupees(7999)->percentRounded(10)->paise);

        // And an even division is untouched.
        self::assertSame(50000, Money::fromRupees(5000)->percentRounded(10)->paise);
    }

    /**
     * The property that actually matters: a percent discount can never leave a
     * total the gateway cannot be asked for.
     */
    public function testAPercentDiscountNeverLeavesSubRupeeChange(): void
    {
        foreach ([10, 15, 20, 25, 33] as $percent) {
            for ($rupees = 1; $rupees <= 400; ++$rupees) {
                $total = Money::fromRupees($rupees)->minus(Money::fromRupees($rupees)->percentRounded($percent));

                self::assertSame(0, $total->paise % 100, sprintf('%d%% of Rs %d left change', $percent, $rupees));
            }
        }
    }

    public function testAmountDiscountClampsToSubtotal(): void
    {
        $subtotal = Money::fromRupees(400);
        $voucher = Money::fromRupees(4600);

        self::assertSame(400, $voucher->clampTo($subtotal)->rupees());
    }

    public function testArithmeticStaysIntegral(): void
    {
        $line = Money::fromRupees(8900)->times(2);
        $total = $line->minus(Money::fromRupees(1335))->plus(Money::fromRupees(199));

        self::assertSame(16664, $total->rupees());
    }

    public function testNegativeAmountsFormatCorrectly(): void
    {
        $owed = Money::fromRupees(100)->minus(Money::fromRupees(350));

        self::assertSame('-250.00', $owed->toDecimalString());
        self::assertSame(0, $owed->atLeastZero()->rupees());
    }
}
