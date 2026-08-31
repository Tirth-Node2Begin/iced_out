<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

final class VoucherRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    /**
     * @param array{q?: string, state?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['1 = 1'];
        $bindings = [];

        // A voucher is Active until an order claims it, and Claimed from that
        // moment — the state is derived from claimed_on, never stored twice.
        if (($filters['state'] ?? '') === 'Active') {
            $where[] = 'claimed_on IS NULL';
        } elseif (($filters['state'] ?? '') === 'Claimed') {
            $where[] = 'claimed_on IS NOT NULL';
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(code LIKE ? OR customer_name LIKE ? OR return_public_id LIKE ? OR reason LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT * FROM vouchers WHERE ' . implode(' AND ', $where) . ' ORDER BY issued_on DESC, id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $code): ?array
    {
        return $this->db->selectOne('SELECT * FROM vouchers WHERE code = ? LIMIT 1', [$code]);
    }

    /** @return list<array<string, mixed>> */
    public function forUser(int $userId): array
    {
        return $this->db->select(
            'SELECT * FROM vouchers WHERE customer_user_id = ? ORDER BY issued_on DESC',
            [$userId],
        );
    }

    /** Hand-issued vouchers carry an empty return id, so many may coexist. */
    public function issue(string $code, string $amount, string $reason, string $customer, ?int $userId, string $issuedOn, string $expiresOn): void
    {
        $this->db->statement(
            "INSERT INTO vouchers (code, amount, return_public_id, reason, customer_name, customer_user_id, issued_on, expires_on)
             VALUES (?, ?, '', ?, ?, ?, ?, ?)",
            [$code, $amount, $reason, $customer, $userId, $issuedOn, $expiresOn],
        );
    }

    /** @param array<string, mixed> $fields */
    public function update(string $code, array $fields): void
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
        $bindings[] = $code;

        $this->db->statement('UPDATE vouchers SET ' . implode(', ', $sets) . ', updated_at = ? WHERE code = ?', $bindings);
    }

    public function void(string $code): void
    {
        $this->db->statement('DELETE FROM vouchers WHERE code = ? AND claimed_on IS NULL', [$code]);
    }

    public function nextHandIssuedCode(): string
    {
        $series = $this->settings->series('voucher', 'IOV', 1, 3);
        $row = $this->db->selectOne(
            'SELECT code FROM vouchers WHERE code LIKE ? ORDER BY code DESC LIMIT 1',
            [$series['prefix'] . '%'],
        );
        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['code']);

        return $series['prefix'] . str_pad((string) max($series['from'], $highest + 1), max(1, $series['width']), '0', STR_PAD_LEFT);
    }

    /** @return list<array<string, mixed>> */
    public function activeCoupons(): array
    {
        return $this->db->select(
            'SELECT code, label, kind, value, min_subtotal FROM coupons
              WHERE active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
              ORDER BY code',
            [$this->clock->nowString(), $this->clock->nowString()],
        );
    }
}
