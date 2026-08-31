<?php

declare(strict_types=1);

namespace Iced\Repository\Crm;

use Iced\Kernel\Database;
use Iced\Support\Clock;

final class ContactRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly CrmIds $ids,
    ) {
    }

    /**
     * The list query carries three things the row itself does not hold: who owns
     * it, which company it belongs to, and whether this person has ever bought
     * anything. The last is what makes the list worth reading — a contact with
     * six orders behind them is a different conversation from one with none.
     *
     * @param array{lifecycle?: string, owner?: string, company?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['c.deleted_at IS NULL'];
        $bindings = [];

        $lifecycle = strtoupper(trim($filters['lifecycle'] ?? ''));

        if ($lifecycle !== '' && $lifecycle !== 'ALL') {
            $where[] = 'c.lifecycle = ?';
            $bindings[] = $lifecycle;
        }

        $owner = trim($filters['owner'] ?? '');

        if ($owner === 'unassigned') {
            $where[] = 'c.owner_user_id IS NULL';
        } elseif ($owner !== '' && $owner !== 'all') {
            $where[] = 'o.public_id = ?';
            $bindings[] = $owner;
        }

        $company = trim($filters['company'] ?? '');

        if ($company !== '' && $company !== 'all') {
            $where[] = 'co.public_id = ?';
            $bindings[] = $company;
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = "(c.public_id LIKE ? OR CONCAT(c.first_name, ' ', c.last_name) LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)";
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT c.*,
                    o.name AS owner_name, o.public_id AS owner_public_id,
                    co.name AS company_name, co.public_id AS company_public_id,
                    u.public_id AS customer_public_id,
                    (SELECT COUNT(*) FROM orders ord
                      WHERE (ord.user_id = c.user_id AND c.user_id IS NOT NULL)
                         OR (LENGTH(c.email_normalized) > 0 AND LOWER(ord.contact_email) = c.email_normalized)) AS orders_count,
                    (SELECT COALESCE(SUM(ord.total), 0) FROM orders ord
                      WHERE (ord.user_id = c.user_id AND c.user_id IS NOT NULL)
                         OR (LENGTH(c.email_normalized) > 0 AND LOWER(ord.contact_email) = c.email_normalized)) AS orders_total,
                    (SELECT COUNT(*) FROM crm_deals d
                      WHERE d.contact_id = c.id AND d.status = \'OPEN\' AND d.deleted_at IS NULL) AS open_deals
               FROM crm_contacts c
               LEFT JOIN users o ON o.id = c.owner_user_id
               LEFT JOIN users u ON u.id = c.user_id
               LEFT JOIN crm_companies co ON co.id = c.company_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY c.last_activity_at IS NULL, c.last_activity_at DESC, c.created_at DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT c.*,
                    o.name AS owner_name, o.public_id AS owner_public_id,
                    co.name AS company_name, co.public_id AS company_public_id,
                    u.public_id AS customer_public_id, u.email AS customer_email,
                    (SELECT COUNT(*) FROM orders ord
                      WHERE (ord.user_id = c.user_id AND c.user_id IS NOT NULL)
                         OR (LENGTH(c.email_normalized) > 0 AND LOWER(ord.contact_email) = c.email_normalized)) AS orders_count,
                    (SELECT COALESCE(SUM(ord.total), 0) FROM orders ord
                      WHERE (ord.user_id = c.user_id AND c.user_id IS NOT NULL)
                         OR (LENGTH(c.email_normalized) > 0 AND LOWER(ord.contact_email) = c.email_normalized)) AS orders_total,
                    (SELECT COUNT(*) FROM crm_deals d
                      WHERE d.contact_id = c.id AND d.status = \'OPEN\' AND d.deleted_at IS NULL) AS open_deals
               FROM crm_contacts c
               LEFT JOIN users o ON o.id = c.owner_user_id
               LEFT JOIN users u ON u.id = c.user_id
               LEFT JOIN crm_companies co ON co.id = c.company_id
              WHERE c.public_id = ? AND c.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email): ?array
    {
        $normalized = mb_strtolower(trim($email));

        if ($normalized === '') {
            return null;
        }

        return $this->db->selectOne(
            'SELECT * FROM crm_contacts WHERE email_normalized = ? AND deleted_at IS NULL LIMIT 1',
            [$normalized],
        );
    }

    /**
     * @param array{firstName: string, lastName: string, email: string, phone: string,
     *              jobTitle: string, lifecycle: string, source: string, city: string,
     *              state: string, country: string, companyId: int|null, userId: int|null,
     *              ownerId: int|null} $input
     *
     * @return array{id: int, publicId: string}
     */
    public function create(array $input): array
    {
        $publicId = $this->ids->mint('contact');

        $id = $this->db->insert(
            'INSERT INTO crm_contacts
                (public_id, user_id, company_id, first_name, last_name, email, email_normalized,
                 phone, job_title, lifecycle, source, city, state, country, owner_user_id,
                 created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $input['userId'],
                $input['companyId'],
                $input['firstName'],
                $input['lastName'],
                $input['email'],
                mb_strtolower(trim($input['email'])),
                $input['phone'],
                $input['jobTitle'],
                $input['lifecycle'],
                $input['source'],
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

        $this->db->statement('UPDATE crm_contacts SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    public function softDelete(int $id): void
    {
        $this->db->statement('UPDATE crm_contacts SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    public function touchActivity(int $id): void
    {
        $this->db->statement('UPDATE crm_contacts SET last_activity_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /**
     * Shopper accounts that no contact record points at yet.
     *
     * This is the "import from the storefront" list: everyone who has bought
     * something but whom the CRM has never been told about.
     *
     * @return list<array<string, mixed>>
     */
    public function unlinkedCustomers(int $limit = 200): array
    {
        return $this->db->select(
            'SELECT u.id, u.public_id, u.name, u.email, u.phone, u.created_at,
                    (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
                    (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.user_id = u.id) AS orders_total
               FROM users u
              WHERE u.type = \'CUSTOMER\'
                AND u.deleted_at IS NULL
                AND NOT EXISTS (
                      SELECT 1 FROM crm_contacts c WHERE c.user_id = u.id AND c.deleted_at IS NULL
                    )
              ORDER BY orders_total DESC, u.created_at DESC
              LIMIT ' . max(1, min($limit, 500)),
        );
    }

    /** @return array<string, int> */
    public function lifecycleCounts(): array
    {
        $counts = [];

        foreach ($this->db->select(
            'SELECT lifecycle, COUNT(*) AS total FROM crm_contacts WHERE deleted_at IS NULL GROUP BY lifecycle',
        ) as $row) {
            $counts[(string) $row['lifecycle']] = (int) $row['total'];
        }

        return $counts;
    }

    /**
     * The commerce half of a contact's timeline.
     *
     * Matched on the account link OR the frozen contact_email, because a guest
     * checkout has no user_id — and a contact whose orders were all placed as a
     * guest is exactly the one whose history you must not lose. Empty for
     * someone who has never bought anything, which is correct, not a failure.
     *
     * @return list<array<string, mixed>>
     */
    public function orders(?int $userId, string $email, int $limit = 20): array
    {
        $normalized = mb_strtolower(trim($email));

        if ($userId === null && $normalized === '') {
            return [];
        }

        return $this->db->select(
            'SELECT public_id, number, status, console_state, total, currency, placed_at, created_at
               FROM orders
              WHERE (user_id = ? AND ? IS NOT NULL)
                 OR (LENGTH(?) > 0 AND LOWER(contact_email) = ?)
              ORDER BY placed_at DESC
              LIMIT ' . max(1, min($limit, 100)),
            [$userId, $userId, $normalized, $normalized],
        );
    }
}
