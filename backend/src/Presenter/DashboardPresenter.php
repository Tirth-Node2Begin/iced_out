<?php

declare(strict_types=1);

namespace Iced\Presenter;

use DateTimeImmutable;
use DateTimeZone;
use Iced\Domain\Money;
use Iced\Support\Clock;

/**
 * The dashboard wire shapes of spec §7.7 — QueueCard, TradingDay, LogEntry,
 * Signal. Notes are written the way the screen reads them, because the count
 * alone never says whether the queue is urgent.
 */
final class DashboardPresenter
{
    public function __construct(private readonly Clock $clock)
    {
    }

    /**
     * @param array<string, mixed> $data
     *
     * @return array<string, array{count: int, note: string}>
     */
    public function queues(array $data): array
    {
        /** @var array<string, mixed> $counts */
        $counts = is_array($data['counts'] ?? null) ? $data['counts'] : [];
        $oldest = is_array($data['oldest_placed'] ?? null) ? $data['oldest_placed'] : null;

        $ordersToConfirm = (int) ($counts['orders_to_confirm'] ?? 0);
        $paymentExceptions = (int) ($counts['payment_exceptions'] ?? 0);
        $readyToDispatch = (int) ($counts['ready_to_dispatch'] ?? 0);
        $returnsToReview = (int) ($counts['returns_to_review'] ?? 0);
        $openTickets = (int) ($counts['open_tickets'] ?? 0);

        /** @var list<string> $notes */
        $notes = is_array($data['failed_payment_notes'] ?? null) ? $data['failed_payment_notes'] : [];

        return [
            'ordersToConfirm' => [
                'count' => $ordersToConfirm,
                'note' => $oldest === null
                    ? 'Nothing waiting on a decision.'
                    : sprintf(
                        '%s has waited %s.',
                        (string) $oldest['number'],
                        Format::age($this->parse((string) $oldest['placed_at']), $this->clock->now()),
                    ),
            ],
            'paymentExceptions' => [
                'count' => $paymentExceptions,
                'note' => $notes === [] ? 'Every payment landed.' : implode(' · ', $notes),
            ],
            'readyToDispatch' => [
                'count' => $readyToDispatch,
                'note' => (int) ($data['failed_shipments'] ?? 0) > 0
                    ? sprintf('%d parcel(s) came back failed.', (int) $data['failed_shipments'])
                    : 'No parcels are stuck.',
            ],
            'returnsToReview' => [
                'count' => $returnsToReview,
                'note' => sprintf('%d already approved and waiting to settle.', (int) ($data['approved_returns'] ?? 0)),
            ],
            'stockAtRisk' => [
                'count' => (int) ($counts['stock_at_risk'] ?? 0),
                'note' => sprintf('%d low, %d sold out.', (int) ($data['stock_low'] ?? 0), (int) ($data['stock_out'] ?? 0)),
            ],
            'openTickets' => [
                'count' => $openTickets,
                'note' => sprintf('%d of them name an order.', (int) ($data['tickets_with_order'] ?? 0)),
            ],
        ];
    }

    /**
     * Offsets, not calendar dates: the console's own window maths counts
     * backwards from today, and 0 is always today whenever the page is opened.
     *
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array{offset: int, revenue: int, orders: int, sessions: int, returns: int}>
     */
    public function trading(array $rows): array
    {
        $today = $this->clock->display($this->clock->now())->setTime(0, 0);
        $series = [];

        foreach ($rows as $row) {
            $day = DateTimeImmutable::createFromFormat(
                'Y-m-d',
                (string) $row['day'],
                new DateTimeZone('Asia/Kolkata'),
            );

            if ($day === false) {
                continue;
            }

            $offset = (int) $today->diff($day->setTime(0, 0))->days;

            $series[] = [
                'offset' => $offset,
                'revenue' => (int) (float) $row['revenue'],
                'orders' => (int) $row['orders'],
                'sessions' => (int) $row['sessions'],
                'returns' => (int) $row['returns'],
            ];
        }

        return $series;
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function activity(array $rows): array
    {
        $now = $this->clock->now();

        return array_map(function (array $row) use ($now): array {
            $born = $this->parse((string) $row['created_at']);

            return [
                'id' => (string) $row['id'],
                'source' => (string) $row['source'],
                'action' => (string) $row['action'],
                'title' => (string) $row['title'],
                'detail' => (string) $row['detail'],
                'actor' => (string) $row['actor'],
                'state' => (string) $row['state'],
                'tone' => (string) $row['tone'],
                'offset' => max(0, $now->getTimestamp() - $born->getTimestamp()),
                'born' => Format::epochMillis($born),
            ];
        }, $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function signals(array $rows): array
    {
        $now = $this->clock->now();

        return array_map(function (array $row) use ($now): array {
            $born = $this->parse((string) $row['created_at']);

            return [
                'id' => (string) $row['id'],
                'kind' => (string) $row['kind'],
                'tone' => (string) $row['tone'],
                'title' => (string) $row['title'],
                'detail' => (string) $row['detail'],
                'href' => (string) $row['href'],
                'offset' => max(0, $now->getTimestamp() - $born->getTimestamp()),
                'born' => Format::epochMillis($born),
            ];
        }, $rows);
    }

    /** @param array<string, mixed> $row */
    public function summary(array $row): array
    {
        return [
            'revenue_today' => Format::rupees(Money::fromRupees((int) (float) ($row['revenue'] ?? 0))),
            'orders_today' => (int) ($row['orders'] ?? 0),
            'sessions_today' => (int) ($row['sessions'] ?? 0),
            'returns_today' => (int) ($row['returns'] ?? 0),
        ];
    }

    private function parse(string $stored): DateTimeImmutable
    {
        return Format::parse($stored) ?? $this->clock->now();
    }
}
