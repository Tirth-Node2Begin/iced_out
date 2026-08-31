<?php

declare(strict_types=1);

namespace Iced\Tests\Contract;

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Support\IdAllocator;
use PHPUnit\Framework\TestCase;

/**
 * Spec §11: records created after the frontend build must take public ids from
 * the pre-rendered slot pools, or they have no page to land on. Needs a
 * migrated + seeded database.
 */
final class IdAllocatorTest extends TestCase
{
    private IdAllocator $allocator;

    protected function setUp(): void
    {
        $app = Application::boot(dirname(__DIR__, 2));

        /** @var Database $db */
        $db = $app->container->get(Database::class);

        if (!$db->isHealthy()) {
            self::markTestSkipped('Database unavailable — run `php bin/console.php migrate && seed` first.');
        }

        /** @var IdAllocator $allocator */
        $allocator = $app->container->get(IdAllocator::class);
        $this->allocator = $allocator;
    }

    public function testEachPoolStartsAtItsReservedFloor(): void
    {
        self::assertSame('ord-local-01', $this->allocator->allocate('order'));
        self::assertSame('track-local-01', $this->allocator->allocate('tracking'));
        self::assertSame('pay_ICE2001', $this->allocator->allocate('payment'));
        self::assertSame('cus-2050', $this->allocator->allocate('customer'));
    }

    public function testOrderNumbersStartAfterTheSeededFixtures(): void
    {
        // Seeded customer orders run to IO-2026-1048; live numbering follows it.
        self::assertSame('IO-2026-1049', $this->allocator->nextOrderNumber());
    }
}
