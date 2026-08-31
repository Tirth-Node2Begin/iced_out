<?php

declare(strict_types=1);

namespace Iced\Repository\Crm;

use Iced\Kernel\Database;
use Iced\Support\Clock;

final class DealRepository
{
    /**
     * Deals are ranked within a stage by `position`, gap-numbered by this step.
     *
     * A drag between two cards takes the midpoint of their positions, so an
     * ordinary reorder is ONE row updated rather than renumbering the column.
     * When the gap closes (roughly seven consecutive drops between the same two
     * cards) `compact()` restores it.
     */
    private const POSITION_STEP = 100;

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly CrmIds $ids,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function pipelines(): array
    {
        return $this->db->select(
            'SELECT * FROM crm_pipelines WHERE deleted_at IS NULL ORDER BY position ASC, id ASC',
        );
    }

    /** @return array<string, mixed>|null */
    public function findPipeline(string $slugOrPublicId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM crm_pipelines
              WHERE (slug = ? OR public_id = ?) AND deleted_at IS NULL
              LIMIT 1',
            [$slugOrPublicId, $slugOrPublicId],
        );
    }

    /** @return array<string, mixed>|null */
    public function defaultPipeline(): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM crm_pipelines
              WHERE deleted_at IS NULL
              ORDER BY is_default DESC, position ASC, id ASC
              LIMIT 1',
        );
    }

    /** @return list<array<string, mixed>> */
    public function stages(int $pipelineId): array
    {
        return $this->db->select(
            'SELECT * FROM crm_stages
              WHERE pipeline_id = ? AND deleted_at IS NULL
              ORDER BY position ASC, id ASC',
            [$pipelineId],
        );
    }

    /** @return array<string, mixed>|null */
    public function findStage(int $pipelineId, string $slugOrPublicId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM crm_stages
              WHERE pipeline_id = ? AND (slug = ? OR public_id = ?) AND deleted_at IS NULL
              LIMIT 1',
            [$pipelineId, $slugOrPublicId, $slugOrPublicId],
        );
    }

    /**
     * Every deal on one board, in column order. The whole board is one query —
     * a kanban that fetches per column is N round trips to draw one screen.
     *
     * @param array{owner?: string, status?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function board(int $pipelineId, array $filters = []): array
    {
        $where = ['d.deleted_at IS NULL', 'd.pipeline_id = ?'];
        $bindings = [$pipelineId];

        $status = strtoupper(trim($filters['status'] ?? ''));

        if ($status !== '' && $status !== 'ALL') {
            $where[] = 'd.status = ?';
            $bindings[] = $status;
        }

        $owner = trim($filters['owner'] ?? '');

        if ($owner === 'unassigned') {
            $where[] = 'd.owner_user_id IS NULL';
        } elseif ($owner !== '' && $owner !== 'all') {
            $where[] = 'o.public_id = ?';
            $bindings[] = $owner;
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(d.public_id LIKE ? OR d.title LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like);
        }

        return $this->db->select(
            'SELECT d.*,
                    s.public_id AS stage_public_id, s.slug AS stage_slug, s.name AS stage_name,
                    s.kind AS stage_kind, s.position AS stage_position,
                    p.slug AS pipeline_slug,
                    o.name AS owner_name, o.public_id AS owner_public_id,
                    c.public_id AS contact_public_id,
                    CONCAT(c.first_name, \' \', c.last_name) AS contact_name,
                    co.public_id AS company_public_id, co.name AS company_name,
                    ord.number AS order_number,
                    (SELECT COUNT(*) FROM crm_activities a
                      WHERE a.subject_type = \'deal\' AND a.subject_id = d.id
                        AND a.completed_at IS NULL AND a.deleted_at IS NULL) AS open_tasks
               FROM crm_deals d
               JOIN crm_stages s ON s.id = d.stage_id
               JOIN crm_pipelines p ON p.id = d.pipeline_id
               LEFT JOIN users o ON o.id = d.owner_user_id
               LEFT JOIN crm_contacts c ON c.id = d.contact_id
               LEFT JOIN crm_companies co ON co.id = d.company_id
               LEFT JOIN orders ord ON ord.id = d.order_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY s.position ASC, d.position ASC, d.id ASC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT d.*,
                    s.public_id AS stage_public_id, s.slug AS stage_slug, s.name AS stage_name,
                    s.kind AS stage_kind, s.position AS stage_position,
                    p.slug AS pipeline_slug, p.public_id AS pipeline_public_id, p.name AS pipeline_name,
                    o.name AS owner_name, o.public_id AS owner_public_id,
                    c.public_id AS contact_public_id, c.email AS contact_email, c.phone AS contact_phone,
                    CONCAT(c.first_name, \' \', c.last_name) AS contact_name,
                    co.public_id AS company_public_id, co.name AS company_name,
                    ord.number AS order_number, ord.public_id AS order_public_id,
                    (SELECT COUNT(*) FROM crm_activities a
                      WHERE a.subject_type = \'deal\' AND a.subject_id = d.id
                        AND a.completed_at IS NULL AND a.deleted_at IS NULL) AS open_tasks
               FROM crm_deals d
               JOIN crm_stages s ON s.id = d.stage_id
               JOIN crm_pipelines p ON p.id = d.pipeline_id
               LEFT JOIN users o ON o.id = d.owner_user_id
               LEFT JOIN crm_contacts c ON c.id = d.contact_id
               LEFT JOIN crm_companies co ON co.id = d.company_id
               LEFT JOIN orders ord ON ord.id = d.order_id
              WHERE d.public_id = ? AND d.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /**
     * @param array{title: string, pipelineId: int, stageId: int, contactId: int|null,
     *              companyId: int|null, amount: string, currency: string, source: string,
     *              probability: int, expectedCloseOn: string|null, ownerId: int|null} $input
     *
     * @return array{id: int, publicId: string}
     */
    public function create(array $input): array
    {
        $publicId = $this->ids->mint('deal');

        $id = $this->db->insert(
            'INSERT INTO crm_deals
                (public_id, title, pipeline_id, stage_id, contact_id, company_id, amount, currency,
                 source, probability, expected_close_on, owner_user_id, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $input['title'],
                $input['pipelineId'],
                $input['stageId'],
                $input['contactId'],
                $input['companyId'],
                $input['amount'],
                $input['currency'],
                $input['source'],
                $input['probability'],
                $input['expectedCloseOn'],
                $input['ownerId'],
                $this->nextPosition($input['stageId']),
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

        $this->db->statement('UPDATE crm_deals SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    /**
     * A board drop: land the card in `$stageId` between the two cards it was
     * dropped between.
     *
     * `$beforeId`/`$afterId` are the deals immediately above and below the drop
     * point, or null at the ends of the column. Passing ids rather than an index
     * is what makes this safe against a stale board — the client tells us WHAT
     * it dropped between, not where it thinks that is in a list that may have
     * changed underneath it.
     *
     * Moving into a WON or LOST stage also settles the deal: status, closed_at
     * and probability all follow the stage kind, because a card sitting in the
     * Won column while still marked OPEN is the kind of disagreement that makes
     * every forecast on the dashboard wrong.
     */
    public function move(int $id, int $stageId, string $stageKind, ?int $beforeId, ?int $afterId): void
    {
        $position = $this->positionBetween($beforeId, $afterId);

        /* No room left between the neighbours. Renumber the column FIRST and ask
           again — compacting afterwards would have to sort the card by the very
           position we could not compute, which lands a mid-column drop at the
           top of the column. */
        if ($position < 0) {
            $this->compact($stageId);
            $position = $this->positionBetween($beforeId, $afterId);
        }

        $changes = [
            'stage_id' => $stageId,
            'position' => $position,
            'updated_at' => $this->clock->nowString(),
        ];

        if ($stageKind === 'WON' || $stageKind === 'LOST') {
            $changes['status'] = $stageKind;
            $changes['closed_at'] = $this->clock->nowString();
            $changes['probability'] = $stageKind === 'WON' ? 100 : 0;
        } else {
            $changes['status'] = 'OPEN';
            $changes['closed_at'] = null;
        }

        $this->update($id, $changes);
    }

    public function softDelete(int $id): void
    {
        $this->db->statement('UPDATE crm_deals SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    public function touchActivity(int $id): void
    {
        $this->db->statement('UPDATE crm_deals SET last_activity_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /** @return list<array<string, mixed>> */
    public function forContact(int $contactId): array
    {
        return $this->db->select(
            'SELECT d.*, s.name AS stage_name, s.kind AS stage_kind, p.slug AS pipeline_slug
               FROM crm_deals d
               JOIN crm_stages s ON s.id = d.stage_id
               JOIN crm_pipelines p ON p.id = d.pipeline_id
              WHERE d.contact_id = ? AND d.deleted_at IS NULL
              ORDER BY d.created_at DESC',
            [$contactId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function forCompany(int $companyId): array
    {
        return $this->db->select(
            'SELECT d.*, s.name AS stage_name, s.kind AS stage_kind, p.slug AS pipeline_slug
               FROM crm_deals d
               JOIN crm_stages s ON s.id = d.stage_id
               JOIN crm_pipelines p ON p.id = d.pipeline_id
              WHERE d.company_id = ? AND d.deleted_at IS NULL
              ORDER BY d.created_at DESC',
            [$companyId],
        );
    }

    /**
     * Board totals: open value, weighted forecast, won and lost this period.
     *
     * The weighted number multiplies each open deal by its own probability
     * rather than its stage's, because a deal can be talked up or down without
     * moving column — and that judgement is the whole point of the field.
     *
     * @return array<string, mixed>
     */
    public function summary(int $pipelineId): array
    {
        $row = $this->db->selectOne(
            'SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN d.status = \'OPEN\' THEN 1 ELSE 0 END) AS open_count,
                COALESCE(SUM(CASE WHEN d.status = \'OPEN\' THEN d.amount ELSE 0 END), 0) AS open_value,
                COALESCE(SUM(CASE WHEN d.status = \'OPEN\' THEN d.amount * d.probability / 100 ELSE 0 END), 0) AS weighted_value,
                SUM(CASE WHEN d.status = \'WON\' THEN 1 ELSE 0 END) AS won_count,
                COALESCE(SUM(CASE WHEN d.status = \'WON\' THEN d.amount ELSE 0 END), 0) AS won_value,
                SUM(CASE WHEN d.status = \'LOST\' THEN 1 ELSE 0 END) AS lost_count,
                COALESCE(SUM(CASE WHEN d.status = \'LOST\' THEN d.amount ELSE 0 END), 0) AS lost_value
               FROM crm_deals d
              WHERE d.pipeline_id = ? AND d.deleted_at IS NULL',
            [$pipelineId],
        );

        return $row ?? [];
    }

    private function nextPosition(int $stageId): int
    {
        $row = $this->db->selectOne(
            'SELECT COALESCE(MAX(position), 0) AS top FROM crm_deals WHERE stage_id = ? AND deleted_at IS NULL',
            [$stageId],
        );

        return (int) ($row['top'] ?? 0) + self::POSITION_STEP;
    }

    /**
     * Returns the midpoint, or a NEGATIVE sentinel when the two neighbours are
     * adjacent integers and there is no room between them. `move()` reads that
     * as "renumber this column, then ask again".
     */
    private function positionBetween(?int $beforeId, ?int $afterId): int
    {
        $before = $beforeId === null ? null : $this->positionOf($beforeId);
        $after = $afterId === null ? null : $this->positionOf($afterId);

        if ($before === null && $after === null) {
            return self::POSITION_STEP;
        }

        if ($before === null) {
            /** @var int $after */
            return $after > 1 ? intdiv($after, 2) : -1;
        }

        if ($after === null) {
            return $before + self::POSITION_STEP;
        }

        if ($after - $before < 2) {
            return -1;
        }

        return intdiv($before + $after, 2);
    }

    private function positionOf(int $dealId): ?int
    {
        $row = $this->db->selectOne('SELECT position FROM crm_deals WHERE id = ? LIMIT 1', [$dealId]);

        return $row === null ? null : (int) $row['position'];
    }

    /** Restores the gaps in one column, preserving the order already on screen. */
    private function compact(int $stageId): void
    {
        $rank = 0;

        foreach ($this->db->select(
            'SELECT id FROM crm_deals WHERE stage_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
            [$stageId],
        ) as $row) {
            $rank += self::POSITION_STEP;
            $this->db->statement('UPDATE crm_deals SET position = ? WHERE id = ?', [$rank, (int) $row['id']]);
        }
    }
}
