<?php

declare(strict_types=1);

namespace Iced\Repository\Crm;

use Iced\Kernel\Database;
use Iced\Support\Clock;

final class CompanyRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly CrmIds $ids,
    ) {
    }

    /**
     * @param array{status?: string, owner?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['co.deleted_at IS NULL'];
        $bindings = [];

        $status = strtoupper(trim($filters['status'] ?? ''));

        if ($status !== '' && $status !== 'ALL') {
            $where[] = 'co.status = ?';
            $bindings[] = $status;
        }

        $owner = trim($filters['owner'] ?? '');

        if ($owner === 'unassigned') {
            $where[] = 'co.owner_user_id IS NULL';
        } elseif ($owner !== '' && $owner !== 'all') {
            $where[] = 'o.public_id = ?';
            $bindings[] = $owner;
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(co.public_id LIKE ? OR co.name LIKE ? OR co.domain LIKE ? OR co.email LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT co.*, o.name AS owner_name, o.public_id AS owner_public_id,
                    (SELECT COUNT(*) FROM crm_contacts c
                      WHERE c.company_id = co.id AND c.deleted_at IS NULL) AS contacts_count,
                    (SELECT COUNT(*) FROM crm_deals d
                      WHERE d.company_id = co.id AND d.status = \'OPEN\' AND d.deleted_at IS NULL) AS open_deals,
                    (SELECT COALESCE(SUM(d.amount), 0) FROM crm_deals d
                      WHERE d.company_id = co.id AND d.status = \'WON\' AND d.deleted_at IS NULL) AS won_value
               FROM crm_companies co
               LEFT JOIN users o ON o.id = co.owner_user_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY co.name ASC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT co.*, o.name AS owner_name, o.public_id AS owner_public_id,
                    (SELECT COUNT(*) FROM crm_contacts c
                      WHERE c.company_id = co.id AND c.deleted_at IS NULL) AS contacts_count,
                    (SELECT COUNT(*) FROM crm_deals d
                      WHERE d.company_id = co.id AND d.status = \'OPEN\' AND d.deleted_at IS NULL) AS open_deals,
                    (SELECT COALESCE(SUM(d.amount), 0) FROM crm_deals d
                      WHERE d.company_id = co.id AND d.status = \'WON\' AND d.deleted_at IS NULL) AS won_value
               FROM crm_companies co
               LEFT JOIN users o ON o.id = co.owner_user_id
              WHERE co.public_id = ? AND co.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /** @return array<string, mixed>|null */
    public function findByName(string $name): ?array
    {
        $normalized = mb_strtolower(trim($name));

        if ($normalized === '') {
            return null;
        }

        return $this->db->selectOne(
            'SELECT * FROM crm_companies WHERE name_normalized = ? AND deleted_at IS NULL LIMIT 1',
            [$normalized],
        );
    }

    /**
     * @param array{name: string, domain: string, industry: string, sizeBand: string,
     *              email: string, phone: string, website: string, city: string,
     *              state: string, country: string, ownerId: int|null} $input
     *
     * @return array{id: int, publicId: string}
     */
    public function create(array $input): array
    {
        $publicId = $this->ids->mint('company');

        $id = $this->db->insert(
            'INSERT INTO crm_companies
                (public_id, name, name_normalized, domain, industry, size_band, email, phone,
                 website, city, state, country, owner_user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $input['name'],
                mb_strtolower(trim($input['name'])),
                $input['domain'],
                $input['industry'],
                $input['sizeBand'],
                $input['email'],
                $input['phone'],
                $input['website'],
                $input['city'],
                $input['state'],
                $input['country'],
                $input['ownerId'],
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );

        return ['id' => $id, 'publicId' => $publicId];
    }

    /** @param array<string, mixed> $changes */
    public function update(int $id, array $changes): void
    {
        if ($changes === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($changes as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $id;

        $this->db->statement('UPDATE crm_companies SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    public function softDelete(int $id): void
    {
        /* The contacts and deals that pointed here keep existing — their FKs are
           ON DELETE SET NULL and this is a soft delete anyway, so nothing is
           orphaned. Archiving an account must not shred its history. */
        $this->db->statement('UPDATE crm_companies SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /**
     * Every company as {publicId, name}, for the pickers on the contact and deal
     * forms. Deliberately not the full search payload: those forms need a list
     * to choose from, not three subqueries per row.
     *
     * @return list<array<string, mixed>>
     */
    public function options(): array
    {
        return $this->db->select(
            'SELECT public_id, name FROM crm_companies
              WHERE deleted_at IS NULL AND status = \'ACTIVE\'
              ORDER BY name ASC',
        );
    }
}
