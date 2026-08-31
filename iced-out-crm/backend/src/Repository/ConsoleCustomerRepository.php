<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;
use Iced\Support\Paginator;

/**
 * The customer register as the console reads it: the account plus its counted
 * order history, so a customer listed with three orders opens onto exactly
 * three and their lifetime value is the sum of them.
 */
final class ConsoleCustomerRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Lifetime value counts every order the customer placed, cancelled ones
     * included — that is the arithmetic the register's own fixture does, and it
     * is what makes the listed value the sum of the history the detail page
     * opens onto rather than a second figure that happens to sit nearby.
     */
    private const SELECT = 'SELECT u.*,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.user_id = u.id) AS lifetime_value
          FROM users u';

    /**
     * @param array{q?: string, state?: string} $filters
     *
     * @return array{rows: list<array<string, mixed>>, total: int}
     */
    public function search(array $filters, Paginator $page): array
    {
        $where = ["u.type = 'CUSTOMER'", 'u.deleted_at IS NULL'];
        $bindings = [];

        if (($filters['state'] ?? '') !== '') {
            $where[] = 'u.status = ?';
            $bindings[] = strtoupper($filters['state']) === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE';
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.public_id LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        $clause = ' WHERE ' . implode(' AND ', $where);

        $count = $this->db->selectOne('SELECT COUNT(*) AS n FROM users u' . $clause, $bindings);

        $rows = $this->db->select(
            self::SELECT . $clause . ' ORDER BY u.last_seen_at DESC, u.id DESC LIMIT ? OFFSET ?',
            [...$bindings, $page->perPage, $page->offset()],
        );

        return ['rows' => $rows, 'total' => $count === null ? 0 : (int) $count['n']];
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            self::SELECT . " WHERE u.public_id = ? AND u.type = 'CUSTOMER' AND u.deleted_at IS NULL LIMIT 1",
            [$publicId],
        );
    }

    public function emailTaken(string $emailNormalized): bool
    {
        return $this->db->selectOne(
            "SELECT id FROM users WHERE email_normalized = ? AND type = 'CUSTOMER' AND deleted_at IS NULL LIMIT 1",
            [$emailNormalized],
        ) !== null;
    }

    /** @param array<string, mixed> $fields */
    public function update(string $publicId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($fields as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $this->clock->nowString();
        $bindings[] = $publicId;

        $this->db->statement('UPDATE users SET ' . implode(', ', $sets) . ', updated_at = ? WHERE public_id = ?', $bindings);
    }

    /** @return list<array<string, mixed>> */
    public function sessions(int $userId): array
    {
        return $this->db->select(
            'SELECT created_at, last_active_at, user_agent FROM user_sessions
              WHERE user_id = ? ORDER BY last_active_at DESC LIMIT 20',
            [$userId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function loginAttempts(string $emailNormalized): array
    {
        return $this->db->select(
            'SELECT was_success, created_at FROM login_attempts
              WHERE email_normalized = ? ORDER BY id DESC LIMIT 20',
            [$emailNormalized],
        );
    }
}
