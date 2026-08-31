<?php

declare(strict_types=1);

namespace Iced\Repository\Crm;

use Iced\Kernel\Database;
use Iced\Support\Clock;

final class LeadRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly CrmIds $ids,
    ) {
    }

    /**
     * @param array{status?: string, source?: string, owner?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['l.deleted_at IS NULL'];
        $bindings = [];

        $status = strtoupper(trim($filters['status'] ?? ''));

        /* "open" is the operator's word for the three statuses that still need a
           human — it is not a column value, so it expands here rather than
           forcing the UI to send three parameters. */
        if ($status === 'OPEN') {
            $where[] = "l.status IN ('NEW','CONTACTED','QUALIFIED')";
        } elseif ($status !== '' && $status !== 'ALL') {
            $where[] = 'l.status = ?';
            $bindings[] = $status;
        }

        $source = strtoupper(trim($filters['source'] ?? ''));

        if ($source !== '' && $source !== 'ALL') {
            $where[] = 'l.source = ?';
            $bindings[] = $source;
        }

        $owner = trim($filters['owner'] ?? '');

        if ($owner === 'unassigned') {
            $where[] = 'l.owner_user_id IS NULL';
        } elseif ($owner !== '' && $owner !== 'all') {
            $where[] = 'o.public_id = ?';
            $bindings[] = $owner;
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(l.public_id LIKE ? OR l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.company_name LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT l.*, o.name AS owner_name, o.public_id AS owner_public_id,
                    c.public_id AS contact_public_id, d.public_id AS deal_public_id
               FROM crm_leads l
               LEFT JOIN users o ON o.id = l.owner_user_id
               LEFT JOIN crm_contacts c ON c.id = l.converted_contact_id
               LEFT JOIN crm_deals d ON d.id = l.converted_deal_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY l.created_at DESC, l.id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT l.*, o.name AS owner_name, o.public_id AS owner_public_id,
                    c.public_id AS contact_public_id, d.public_id AS deal_public_id
               FROM crm_leads l
               LEFT JOIN users o ON o.id = l.owner_user_id
               LEFT JOIN crm_contacts c ON c.id = l.converted_contact_id
               LEFT JOIN crm_deals d ON d.id = l.converted_deal_id
              WHERE l.public_id = ? AND l.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /**
     * @param array{name: string, email: string, phone: string, company: string,
     *              source: string, status: string, score: int, message: string,
     *              ownerId: int|null} $input
     */
    public function create(array $input): string
    {
        $publicId = $this->ids->mint('lead');

        $this->db->insert(
            'INSERT INTO crm_leads
                (public_id, name, email, email_normalized, phone, company_name, source, status,
                 score, message, owner_user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $input['name'],
                $input['email'],
                mb_strtolower(trim($input['email'])),
                $input['phone'],
                $input['company'],
                $input['source'],
                $input['status'],
                $input['score'],
                $input['message'],
                $input['ownerId'],
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );

        return $publicId;
    }

    /** @param array<string, mixed> $changes */
    public function update(int $id, array $changes): void
    {
        if ($changes === []) {
            return;
        }

        /* Column names are keys of an array this class builds, never request
           input — the controller maps the payload onto them first. */
        $sets = [];
        $bindings = [];

        foreach ($changes as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $id;

        $this->db->statement('UPDATE crm_leads SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    public function markConverted(int $id, int $contactId, ?int $dealId): void
    {
        $this->db->statement(
            'UPDATE crm_leads
                SET status = ?, converted_contact_id = ?, converted_deal_id = ?, converted_at = ?
              WHERE id = ?',
            ['CONVERTED', $contactId, $dealId, $this->clock->nowString(), $id],
        );
    }

    public function softDelete(int $id): void
    {
        $this->db->statement('UPDATE crm_leads SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    public function touchActivity(int $id): void
    {
        $this->db->statement('UPDATE crm_leads SET last_activity_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /**
     * Counts per status for the module header, in one pass rather than five.
     *
     * @return array<string, int>
     */
    public function statusCounts(): array
    {
        $counts = [];

        foreach ($this->db->select(
            'SELECT status, COUNT(*) AS total FROM crm_leads WHERE deleted_at IS NULL GROUP BY status',
        ) as $row) {
            $counts[(string) $row['status']] = (int) $row['total'];
        }

        return $counts;
    }
}
