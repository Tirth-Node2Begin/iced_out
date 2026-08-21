<?php

declare(strict_types=1);

namespace Iced\Tests\Unit;

use DateTimeImmutable;
use DateTimeZone;
use Iced\Domain\Money;
use Iced\Presenter\Format;
use PHPUnit\Framework\TestCase;

/**
 * The formatting table of spec §7.1 is a contract with rendered UI text, so
 * every example in that table is pinned here.
 */
final class FormatTest extends TestCase
{
    public function testCustomerMoneyUsesIndianGrouping(): void
    {
        self::assertSame('₹17,800', Format::rupees(Money::fromRupees(17800)));
        self::assertSame('₹42,600', Format::rupees(Money::fromRupees(42600)));
        self::assertSame('₹8,900', Format::rupees(Money::fromRupees(8900)));
        self::assertSame('₹999', Format::rupees(Money::fromRupees(999)));
    }

    public function testLakhGroupingPairsAboveTheFirstThousand(): void
    {
        self::assertSame('1,00,000', Format::groupIndian(100000));
        self::assertSame('4,28,420', Format::groupIndian(428420));
        self::assertSame('1,23,45,678', Format::groupIndian(12345678));
    }

    public function testConsoleAmountsArePlainIntegerStrings(): void
    {
        self::assertSame('17800', Format::plainAmount(Money::fromRupees(17800)));
        self::assertSame('3499', Format::plainAmount(Money::fromRupees(3499)));
    }

    public function testDateShapes(): void
    {
        $moment = new DateTimeImmutable('2026-08-04 09:02:00', new DateTimeZone('UTC'));

        self::assertSame('04 Aug 2026', Format::longDate($moment));
        self::assertSame('04 Aug', Format::shortDate($moment));
        self::assertSame('2026-08-04', Format::isoDate($moment));
    }

    public function testTimestampsRenderInAsiaKolkataRegardlessOfInputZone(): void
    {
        // 09:02 UTC is 14:32 IST — the ledger stamp of the spec's example.
        $moment = new DateTimeImmutable('2026-08-04 09:02:00', new DateTimeZone('UTC'));

        self::assertSame('04 Aug, 14:32', Format::ledgerStamp($moment));
    }

    public function testDeliveryWindowsUseTheirOwnDashSpacing(): void
    {
        $from = new DateTimeImmutable('2026-08-12 06:00:00', new DateTimeZone('UTC'));
        $to = new DateTimeImmutable('2026-08-14 06:00:00', new DateTimeZone('UTC'));

        self::assertSame('12 – 14 Aug', Format::spacedWindow($from, $to));

        $promiseFrom = new DateTimeImmutable('2026-08-08 06:00:00', new DateTimeZone('UTC'));
        $promiseTo = new DateTimeImmutable('2026-08-09 06:00:00', new DateTimeZone('UTC'));

        self::assertSame('08–09 Aug', Format::tightWindow($promiseFrom, $promiseTo));
    }

    public function testOrderAge(): void
    {
        $placed = new DateTimeImmutable('2026-08-14 06:00:00', new DateTimeZone('UTC'));

        self::assertSame('1 h 04 min', Format::age($placed, $placed->modify('+64 minutes')));
        self::assertSame('2 d 6 h', Format::age($placed, $placed->modify('+54 hours')));
    }

    public function testNameMasking(): void
    {
        self::assertSame('A•••• K••••', Format::maskName('Aarav Kapoor'));
        self::assertSame('I•••• S••••', Format::maskName('  Iced_out   Shopper '));
    }
}
