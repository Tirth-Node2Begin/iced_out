<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;
use Iced\Support\Paginator;

final class PaymentRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    /**
     * @param array{status?: string, gateway?: string, q?: string} $filters
     *
     * @return array{rows: list<array<string, mixed>>, total: int}
     */
    public function search(array $filters, Paginator $page): array
    {
        $where = ['1 = 1'];
        $bindings = [];

        foreach (['status' => 'p.status', 'gateway' => 'p.gateway'] as $key => $column) {
            if (($filters[$key] ?? '') !== '') {
                $where[] = $column . ' = ?';
                $bindings[] = $filters[$key];
            }
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(p.public_id LIKE ? OR o.number LIKE ? OR p.reference LIKE ? OR p.customer_masked LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        $sql = 'FROM payments p JOIN orders o ON o.id = p.order_id WHERE ' . implode(' AND ', $where);

        $count = $this->db->selectOne('SELECT COUNT(*) AS n ' . $sql, $bindings);

        $rows = $this->db->select(
            'SELECT p.*, o.number AS order_number ' . $sql . ' ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?',
            [...$bindings, $page->perPage, $page->offset()],
        );

        return ['rows' => $rows, 'total' => $count === null ? 0 : (int) $count['n']];
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT p.*, o.number AS order_number FROM payments p JOIN orders o ON o.id = p.order_id
              WHERE p.public_id = ? LIMIT 1',
            [$publicId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function attempts(int $paymentId): array
    {
        return $this->db->select(
            'SELECT operation, outcome, created_at FROM payment_attempts WHERE payment_id = ? ORDER BY id',
            [$paymentId],
        );
    }

    public function setStatus(int $paymentId, string $status, string $note): void
    {
        $this->db->statement(
            'UPDATE payments SET status = ?, note = ?, updated_at = ? WHERE id = ?',
            [$status, $note, $this->clock->nowString(), $paymentId],
        );
    }

    public function recordAttempt(int $paymentId, string $operation, string $outcome, ?string $response = null): void
    {
        $this->db->statement(
            'INSERT INTO payment_attempts (payment_id, operation, response_json, outcome, created_at) VALUES (?, ?, ?, ?, ?)',
            [$paymentId, $operation, $response, $outcome, $this->clock->nowString()],
        );
    }

    /* ------------------------------------------------------------- refunds */

    /** @return list<array<string, mixed>> */
    public function refunds(): array
    {
        return $this->db->select(
            'SELECT r.*, p.public_id AS payment_public_id FROM refunds r
               JOIN payments p ON p.id = r.payment_id ORDER BY r.created_at DESC, r.id DESC',
        );
    }

    /** @return array<string, mixed>|null */
    public function findRefund(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT r.*, p.public_id AS payment_public_id FROM refunds r
               JOIN payments p ON p.id = r.payment_id WHERE r.public_id = ? LIMIT 1',
            [$publicId],
        );
    }

    public function nextRefundId(): string
    {
        $series = $this->settings->series('refund', 'ref_ICE', 1, 3);
        $row = $this->db->selectOne('SELECT public_id FROM refunds ORDER BY public_id DESC LIMIT 1');
        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['public_id']);

        return $series['prefix'] . str_pad((string) max($series['from'], $highest + 1), max(1, $series['width']), '0', STR_PAD_LEFT);
    }

    /**
     * Why money went back — a list finance owns, not a constant.
     *
     * @return list<string>
     */
    public function refundReasons(): array
    {
        return $this->settings->vocabulary('payments.refund_reasons', [
            'Return approved', 'Order cancelled', 'Payment mismatch', 'Goodwill',
        ]);
    }

    public function insertRefund(string $publicId, int $paymentId, string $orderNumber, string $amount, string $reason, ?int $requestedBy): void
    {
        $this->db->statement(
            "INSERT INTO refunds (public_id, payment_id, order_number, amount, reason, status, requested_by, created_at)
             VALUES (?, ?, ?, ?, ?, 'Requested', ?, ?)",
            [$publicId, $paymentId, $orderNumber, $amount, $reason, $requestedBy, $this->clock->nowString()],
        );
    }

    public function setRefundStatus(string $publicId, string $status, ?int $approvedBy): void
    {
        $this->db->statement(
            'UPDATE refunds SET status = ?, approved_by = ?, updated_at = ? WHERE public_id = ?',
            [$status, $approvedBy, $this->clock->nowString(), $publicId],
        );
    }

    /** Total already refunded against a payment — what decides "fully refunded". */
    public function refundedTotal(int $paymentId): string
    {
        $row = $this->db->selectOne(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE payment_id = ? AND status = 'Succeeded'",
            [$paymentId],
        );

        return $row === null ? '0.00' : (string) $row['total'];
    }

    /* ------------------------------------------------------------- payouts */

    /** @return list<array<string, mixed>> */
    public function payouts(): array
    {
        return $this->db->select('SELECT * FROM payouts ORDER BY created_at DESC, id DESC');
    }

    /** @return array<string, mixed>|null */
    public function findPayout(string $publicId): ?array
    {
        return $this->db->selectOne('SELECT * FROM payouts WHERE public_id = ? LIMIT 1', [$publicId]);
    }

    public function markPayoutPaid(string $publicId): void
    {
        $this->db->statement(
            "UPDATE payouts SET status = 'Paid', paid_at = ?, updated_at = ? WHERE public_id = ?",
            [$this->clock->nowString(), $this->clock->nowString(), $publicId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function forExport(string $from, string $to): array
    {
        return $this->db->select(
            'SELECT p.public_id, o.number AS order_number, p.gateway, p.method, p.amount, p.status, p.reference, p.created_at
               FROM payments p JOIN orders o ON o.id = p.order_id
              WHERE p.created_at BETWEEN ? AND ? ORDER BY p.created_at',
            [$from, $to],
        );
    }
}
