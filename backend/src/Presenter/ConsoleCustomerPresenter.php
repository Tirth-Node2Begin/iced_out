<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;

/** CustomerRow (spec §7.4) — every value a string, money written the customer-facing way. */
final class ConsoleCustomerPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function row(array $row): array
    {
        $seen = Format::parse(isset($row['last_seen_at']) ? (string) $row['last_seen_at'] : null);

        return [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'phone' => (string) $row['phone'],
            'orders' => (string) (int) ($row['order_count'] ?? 0),
            'value' => Format::rupees(Money::fromDecimalString((string) ($row['lifetime_value'] ?? '0'))),
            'state' => (string) $row['status'] === 'BLOCKED' ? 'Blocked' : 'Active',
            'seen' => $seen === null ? '' : Format::ledgerStamp($seen),
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function rows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->row($row), $rows);
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array{orders: int, value: string, since: string}
     */
    public function stats(array $row): array
    {
        $since = Format::parse(isset($row['created_at']) ? (string) $row['created_at'] : null);

        return [
            'orders' => (int) ($row['order_count'] ?? 0),
            'value' => Format::rupees(Money::fromDecimalString((string) ($row['lifetime_value'] ?? '0'))),
            'since' => $since === null ? '' : Format::longDate($since),
        ];
    }

    /**
     * Sign-in activity, masked: the console sees when and from what, never the
     * full user agent string or an address.
     *
     * @param list<array<string, mixed>> $sessions
     * @param list<array<string, mixed>> $attempts
     *
     * @return array<string, mixed>
     */
    public function activity(array $sessions, array $attempts): array
    {
        $failures = 0;

        foreach ($attempts as $attempt) {
            if (!(bool) $attempt['was_success']) {
                ++$failures;
            }
        }

        return [
            'sessions' => array_map(static function (array $session): array {
                $active = Format::parse((string) $session['last_active_at']);

                return [
                    'lastActive' => $active === null ? '' : Format::ledgerStamp($active),
                    'device' => self::device((string) $session['user_agent']),
                ];
            }, $sessions),
            'recentFailures' => $failures,
        ];
    }

    private static function device(string $userAgent): string
    {
        return match (true) {
            str_contains($userAgent, 'Mobile') => 'Mobile browser',
            str_contains($userAgent, 'Mozilla') => 'Desktop browser',
            $userAgent === '' => 'Unknown',
            default => 'API client',
        };
    }
}
