<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

final class ReturnRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    /**
     * @param array{tab?: string, state?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['1 = 1'];
        $bindings = [];

        // The tab a record was raised on decides where it lives — a Voucher
        // return is on Returns, an Exchange on Exchanges, nothing on both.
        if (($filters['tab'] ?? '') === 'exchanges') {
            $where[] = "r.outcome = 'Exchange'";
        } elseif (($filters['tab'] ?? '') === 'requests') {
            $where[] = "r.outcome = 'Voucher'";
        }

        if (($filters['state'] ?? '') !== '') {
            $where[] = 'r.state = ?';
            $bindings[] = $filters['state'];
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(r.public_id LIKE ? OR r.order_number LIKE ? OR r.customer_name LIKE ? OR r.item_label LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT r.*, p.public_id AS replacement_slug, p.price AS replacement_price
               FROM return_requests r
               LEFT JOIN products p ON p.id = r.replacement_product_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY r.created_at DESC, r.id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT r.*, p.public_id AS replacement_slug, p.price AS replacement_price
               FROM return_requests r
               LEFT JOIN products p ON p.id = r.replacement_product_id
              WHERE r.public_id = ? LIMIT 1',
            [$publicId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function forUser(int $userId): array
    {
        return $this->db->select(
            'SELECT r.*, p.public_id AS replacement_slug, p.price AS replacement_price
               FROM return_requests r
               LEFT JOIN products p ON p.id = r.replacement_product_id
              WHERE r.user_id = ? ORDER BY r.created_at DESC',
            [$userId],
        );
    }

    public function setState(int $returnId, string $state, string $customerStatus): void
    {
        $this->db->statement(
            'UPDATE return_requests SET state = ?, customer_status = ?, updated_at = ? WHERE id = ?',
            [$state, $customerStatus, $this->clock->nowString(), $returnId],
        );
    }

    public function appendHistory(int $returnId, string $from, string $to, ?int $actorId, string $note): void
    {
        $this->db->statement(
            'INSERT INTO return_status_history (return_id, from_state, to_state, actor_id, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$returnId, $from, $to, $actorId, $note, $this->clock->nowString()],
        );
    }

    /** @return list<array<string, mixed>> */
    public function history(int $returnId): array
    {
        return $this->db->select(
            'SELECT from_state, to_state, note, created_at FROM return_status_history
              WHERE return_id = ? ORDER BY id',
            [$returnId],
        );
    }

    /** Gap-filling, exactly as the frontend's mintReturnId does. */
    public function nextPublicId(): string
    {
        $series = $this->settings->series('return', 'ret-', 1, 3);
        $taken = [];

        foreach ($this->db->select(
            'SELECT public_id FROM return_requests WHERE public_id LIKE ?',
            [$series['prefix'] . '%'],
        ) as $row) {
            $taken[(string) $row['public_id']] = true;
        }

        for ($serial = $series['from']; $serial < $series['from'] + 100000; ++$serial) {
            $candidate = $series['prefix'] . str_pad((string) $serial, max(1, $series['width']), '0', STR_PAD_LEFT);

            if (!isset($taken[$candidate])) {
                return $candidate;
            }
        }

        return $series['prefix'] . (count($taken) + 1);
    }

    /**
     * Why a piece came back, and what the customer asked for in exchange.
     * Both are lists the store owns.
     *
     * @return list<string>
     */
    public function reasons(): array
    {
        return $this->settings->vocabulary('returns.reasons', [
            'Size / fit', 'Changed mind', 'Quality concern', 'Wrong item', 'Damaged in transit',
        ]);
    }

    /** @return list<string> */
    public function outcomes(): array
    {
        return $this->settings->vocabulary('returns.outcomes', ['Voucher', 'Exchange']);
    }

    public function insert(
        string $publicId,
        string $orderNumber,
        ?int $userId,
        string $customerName,
        string $itemLabel,
        ?int $orderItemId,
        string $reason,
        string $outcome,
        string $amount,
        ?int $replacementProductId,
        string $replacementLabel,
        string $destination,
        string $pickupSlot,
    ): int {
        return $this->db->insert(
            "INSERT INTO return_requests
                (public_id, order_number, user_id, customer_name, item_label, order_item_id, reason, outcome,
                 amount, replacement_product_id, replacement_label, state, customer_status, destination,
                 reference, pickup_slot, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pickup scheduled', ?, ?, ?, ?)",
            [
                $publicId, $orderNumber, $userId, $customerName, $itemLabel, $orderItemId, $reason, $outcome,
                $amount, $replacementProductId, $replacementLabel, $destination,
                strtoupper(str_replace('-', '', $publicId)), $pickupSlot, $this->clock->nowString(),
            ],
        );
    }
}
