<?php

declare(strict_types=1);

namespace Iced\Repository\Crm;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * Tasks, calls, meetings and logged messages.
 *
 * `subject_type`/`subject_id` is polymorphic, so every method that resolves a
 * subject goes through `SUBJECT_TABLES` rather than interpolating whatever the
 * request sent — the map is the allow-list, and a type outside it never reaches
 * SQL.
 */
final class ActivityRepository
{
    /** @var array<string, string> */
    private const SUBJECT_TABLES = [
        'lead' => 'crm_leads',
        'contact' => 'crm_contacts',
        'company' => 'crm_companies',
        'deal' => 'crm_deals',
        'order' => 'orders',
    ];

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly CrmIds $ids,
    ) {
    }

    public static function knowsSubject(string $type): bool
    {
        return isset(self::SUBJECT_TABLES[$type]);
    }

    /**
     * Resolves `{type, public id}` to the row id an activity hangs off.
     * Returns null when the type is unknown or the record is gone.
     */
    public function resolveSubject(string $type, string $publicId): ?int
    {
        if (!isset(self::SUBJECT_TABLES[$type])) {
            return null;
        }

        $table = self::SUBJECT_TABLES[$type];

        /* `orders` has no deleted_at column; every CRM table does. */
        $sql = $table === 'orders'
            ? 'SELECT id FROM orders WHERE public_id = ? OR number = ? LIMIT 1'
            : sprintf('SELECT id FROM %s WHERE public_id = ? AND deleted_at IS NULL LIMIT 1', $table);

        $row = $table === 'orders'
            ? $this->db->selectOne($sql, [$publicId, $publicId])
            : $this->db->selectOne($sql, [$publicId]);

        return $row === null ? null : (int) $row['id'];
    }

    /**
     * @param array{scope?: string, type?: string, owner?: string, subjectType?: string,
     *              subjectId?: int|null, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['a.deleted_at IS NULL'];
        $bindings = [];

        /**
         * The four words the UI actually asks in: what is late, what is today,
         * what is still open at all, what is done. `upcoming` deliberately
         * excludes undated tasks — a task with no due date is a wish, and it
         * belongs in `open`, not on a calendar.
         */
        $scope = strtolower(trim($filters['scope'] ?? 'all'));
        $now = $this->clock->nowString();

        if ($scope === 'overdue') {
            $where[] = 'a.completed_at IS NULL AND a.due_at IS NOT NULL AND a.due_at < ?';
            $bindings[] = $now;
        } elseif ($scope === 'today') {
            $where[] = 'a.completed_at IS NULL AND a.due_at IS NOT NULL AND DATE(a.due_at) = DATE(?)';
            $bindings[] = $now;
        } elseif ($scope === 'upcoming') {
            $where[] = 'a.completed_at IS NULL AND a.due_at IS NOT NULL AND a.due_at >= ?';
            $bindings[] = $now;
        } elseif ($scope === 'open') {
            $where[] = 'a.completed_at IS NULL';
        } elseif ($scope === 'done') {
            $where[] = 'a.completed_at IS NOT NULL';
        }

        $type = strtoupper(trim($filters['type'] ?? ''));

        if ($type !== '' && $type !== 'ALL') {
            $where[] = 'a.type = ?';
            $bindings[] = $type;
        }

        $owner = trim($filters['owner'] ?? '');

        if ($owner === 'unassigned') {
            $where[] = 'a.owner_user_id IS NULL';
        } elseif ($owner !== '' && $owner !== 'all') {
            $where[] = 'o.public_id = ?';
            $bindings[] = $owner;
        }

        $subjectType = trim($filters['subjectType'] ?? '');
        $subjectId = $filters['subjectId'] ?? null;

        if ($subjectType !== '' && is_int($subjectId)) {
            $where[] = 'a.subject_type = ? AND a.subject_id = ?';
            array_push($bindings, $subjectType, $subjectId);
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(a.public_id LIKE ? OR a.subject LIKE ? OR a.body LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT a.*, o.name AS owner_name, o.public_id AS owner_public_id, au.name AS author_name
               FROM crm_activities a
               LEFT JOIN users o ON o.id = a.owner_user_id
               LEFT JOIN users au ON au.id = a.created_by
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY a.completed_at IS NOT NULL,
                       a.due_at IS NULL,
                       a.due_at ASC,
                       a.created_at DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT a.*, o.name AS owner_name, o.public_id AS owner_public_id, au.name AS author_name
               FROM crm_activities a
               LEFT JOIN users o ON o.id = a.owner_user_id
               LEFT JOIN users au ON au.id = a.created_by
              WHERE a.public_id = ? AND a.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /**
     * @param array{type: string, subject: string, body: string, subjectType: string,
     *              subjectId: int, dueAt: string|null, priority: string,
     *              ownerId: int|null, createdBy: int|null} $input
     */
    public function create(array $input): string
    {
        $publicId = $this->ids->mint('activity');

        $this->db->insert(
            'INSERT INTO crm_activities
                (public_id, type, subject, body, subject_type, subject_id, due_at, priority,
                 owner_user_id, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $input['type'],
                $input['subject'],
                $input['body'],
                $input['subjectType'],
                $input['subjectId'],
                $input['dueAt'],
                $input['priority'],
                $input['ownerId'],
                $input['createdBy'],
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

        $sets = [];
        $bindings = [];

        foreach ($changes as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $id;

        $this->db->statement('UPDATE crm_activities SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    public function complete(int $id, string $outcome): void
    {
        $this->update($id, [
            'completed_at' => $this->clock->nowString(),
            'outcome' => $outcome,
            'updated_at' => $this->clock->nowString(),
        ]);
    }

    /** Ticking a task back open clears the outcome — it did not happen after all. */
    public function reopen(int $id): void
    {
        $this->update($id, [
            'completed_at' => null,
            'outcome' => '',
            'updated_at' => $this->clock->nowString(),
        ]);
    }

    public function softDelete(int $id): void
    {
        $this->db->statement('UPDATE crm_activities SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /**
     * The three numbers the rail badge and the dashboard both want.
     *
     * @return array{overdue: int, today: int, open: int}
     */
    public function counts(?int $ownerId = null): array
    {
        $now = $this->clock->nowString();

        /* Bindings are built in STATEMENT order, not in the order the clauses
           were assembled: positional placeholders are filled left to right, and
           the two in the SELECT list come before the one in the WHERE. */
        $bindings = [$now, $now];
        $where = ['deleted_at IS NULL', 'completed_at IS NULL'];

        if ($ownerId !== null) {
            $where[] = 'owner_user_id = ?';
            $bindings[] = $ownerId;
        }

        $row = $this->db->selectOne(
            'SELECT
                SUM(CASE WHEN due_at IS NOT NULL AND due_at < ? THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN due_at IS NOT NULL AND DATE(due_at) = DATE(?) THEN 1 ELSE 0 END) AS today,
                COUNT(*) AS open
               FROM crm_activities
              WHERE ' . implode(' AND ', $where),
            $bindings,
        );

        return [
            'overdue' => (int) ($row['overdue'] ?? 0),
            'today' => (int) ($row['today'] ?? 0),
            'open' => (int) ($row['open'] ?? 0),
        ];
    }
}
