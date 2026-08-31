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

    public function testPercentDiscountsRoundDown(): void
    {
        // 15% of ₹7,501 is ₹1,125.15 — the engine floors, never rounds up.
        $discount = Money::fromRupees(7501)->percentFloor(15);

        self::assertSame(112515, $discount->paise);
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
