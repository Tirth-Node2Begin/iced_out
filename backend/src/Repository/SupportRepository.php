<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

final class SupportRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    /**
     * @param array{status?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['1 = 1'];
        $bindings = [];
        $status = strtolower($filters['status'] ?? 'all');

        if ($status === 'open') {
            $where[] = "status = 'Open'";
        } elseif ($status === 'resolved') {
            $where[] = "status = 'Resolved'";
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(public_id LIKE ? OR customer_name LIKE ? OR email LIKE ? OR order_number LIKE ? OR message LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT * FROM support_queries WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC, id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $reference): ?array
    {
        return $this->db->selectOne('SELECT * FROM support_queries WHERE public_id = ? LIMIT 1', [$reference]);
    }

    /** @return list<array<string, mixed>> */
    public function forUser(int $userId, string $email): array
    {
        return $this->db->select(
            'SELECT * FROM support_queries WHERE user_id = ? OR email = ? ORDER BY created_at DESC',
            [$userId, $email],
        );
    }

    public function nextReference(): string
    {
        $series = $this->settings->series('support', 'IO-Q-', 1004);
        $row = $this->db->selectOne('SELECT public_id FROM support_queries ORDER BY public_id DESC LIMIT 1');
        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['public_id']);

        return $series['prefix'] . max($series['from'], $highest + 1);
    }

    /**
     * The five things a query can be about — both sides read this one list.
     *
     * @return list<string>
     */
    public function topics(): array
    {
        return $this->settings->vocabulary('support.topics', [
            'Delivery', 'Return or exchange', 'Payment or refund', 'Product and fit', 'Something else',
        ]);
    }

    public function insert(
        string $reference,
        string $customer,
        string $email,
        ?int $userId,
        string $topic,
        string $orderNumber,
        string $message,
        string $sentLabel,
    ): int {
        return $this->db->insert(
            "INSERT INTO support_queries
                (public_id, customer_name, email, user_id, topic, order_number, message, sent_label, status, reply, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', '', ?)",
            [$reference, $customer, $email, $userId, $topic, $orderNumber, $message, $sentLabel, $this->clock->nowString()],
        );
    }

    /** Answering IS resolving — the store has one verb here, not two. */
    public function resolve(int $queryId, string $reply, ?int $actorId): void
    {
        $this->db->statement(
            "UPDATE support_queries SET status = 'Resolved', reply = ?, resolved_by = ?, updated_at = ? WHERE id = ?",
            [$reply, $actorId, $this->clock->nowString(), $queryId],
        );
    }

    /** Reopening preserves the reply — the answer given was still given. */
    public function reopen(int $queryId): void
    {
        $this->db->statement(
            "UPDATE support_queries SET status = 'Open', updated_at = ? WHERE id = ?",
            [$this->clock->nowString(), $queryId],
        );
    }

    public function appendHistory(int $queryId, string $from, string $to, ?int $actorId): void
    {
        $this->db->statement(
            'INSERT INTO support_status_history (query_id, from_status, to_status, actor_id, created_at) VALUES (?, ?, ?, ?, ?)',
            [$queryId, $from, $to, $actorId, $this->clock->nowString()],
        );
    }

    /** @return list<array<string, mixed>> */
    public function faqs(string $q): array
    {
        if ($q !== '') {
            return $this->db->select(
                'SELECT question, answer FROM faqs WHERE is_active = 1 AND (question LIKE ? OR answer LIKE ?) ORDER BY position',
                ['%' . $q . '%', '%' . $q . '%'],
            );
        }

        return $this->db->select('SELECT question, answer FROM faqs WHERE is_active = 1 ORDER BY position');
    }
}
