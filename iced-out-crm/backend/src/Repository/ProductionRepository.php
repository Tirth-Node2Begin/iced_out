<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;
use Iced\Support\IdAllocator;

/**
 * Purchases and production runs — the two ends of the material flow.
 *
 * A purchase brings material IN; a run takes it OUT and puts finished units into
 * `stock_items`. Both are state machines, and both keep their line items frozen
 * rather than recomputed, so what a document said at the time survives a later
 * change to a price or a recipe.
 */
final class ProductionRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly IdAllocator $ids,
    ) {
    }

    /* ------------------------------------------------------------ purchases */

    /**
     * @param array{status?: string, supplier?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function purchases(array $filters = []): array
    {
        $where = ['p.deleted_at IS NULL'];
        $bindings = [];

        $status = strtoupper(trim($filters['status'] ?? ''));

        /* "open" is the operator's word for the two states that still owe a
           delivery — not a column value, so it expands here. */
        if ($status === 'OPEN') {
            $where[] = "p.status IN ('ORDERED','PARTIAL')";
        } elseif ($status !== '' && $status !== 'ALL') {
            $where[] = 'p.status = ?';
            $bindings[] = $status;
        }

        $supplier = trim($filters['supplier'] ?? '');

        if ($supplier !== '' && $supplier !== 'all') {
            $where[] = 's.public_id = ?';
            $bindings[] = $supplier;
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(p.public_id LIKE ? OR s.name LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like);
        }

        return $this->db->select(
            'SELECT p.*, s.name AS supplier_name, s.public_id AS supplier_public_id,
                    u.name AS owner_name, u.public_id AS owner_public_id,
                    (SELECT COUNT(*) FROM material_purchase_items i WHERE i.purchase_id = p.id) AS line_count,
                    (SELECT COALESCE(SUM(i.qty_ordered * i.unit_cost), 0)
                       FROM material_purchase_items i WHERE i.purchase_id = p.id) AS total_cost,
                    (SELECT COALESCE(SUM(i.qty_ordered), 0)
                       FROM material_purchase_items i WHERE i.purchase_id = p.id) AS qty_ordered,
                    (SELECT COALESCE(SUM(i.qty_received), 0)
                       FROM material_purchase_items i WHERE i.purchase_id = p.id) AS qty_received
               FROM material_purchases p
               JOIN suppliers s ON s.id = p.supplier_id
               LEFT JOIN users u ON u.id = p.owner_user_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY p.created_at DESC, p.id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function findPurchase(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT p.*, s.name AS supplier_name, s.public_id AS supplier_public_id,
                    s.lead_time_days, u.name AS owner_name, u.public_id AS owner_public_id,
                    (SELECT COALESCE(SUM(i.qty_ordered * i.unit_cost), 0)
                       FROM material_purchase_items i WHERE i.purchase_id = p.id) AS total_cost
               FROM material_purchases p
               JOIN suppliers s ON s.id = p.supplier_id
               LEFT JOIN users u ON u.id = p.owner_user_id
              WHERE p.public_id = ? AND p.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function purchaseLines(int $purchaseId): array
    {
        return $this->db->select(
            'SELECT i.*, m.public_id AS material_public_id, m.name AS material_name,
                    m.unit, m.code
               FROM material_purchase_items i
               JOIN materials m ON m.id = i.material_id
              WHERE i.purchase_id = ?
              ORDER BY m.name ASC',
            [$purchaseId],
        );
    }

    /** @return array{id: int, publicId: string} */
    public function createPurchase(int $supplierId, ?string $expectedOn, string $notes, ?int $ownerId): array
    {
        $publicId = $this->ids->allocateGapFilling('material_purchases', 'public_id', 'po-', 4, 1);

        $id = $this->db->insert(
            'INSERT INTO material_purchases
                (public_id, supplier_id, status, expected_on, notes, owner_user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $supplierId,
                'DRAFT',
                $expectedOn,
                $notes,
                $ownerId,
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );

        return ['id' => $id, 'publicId' => $publicId];
    }

    /** @param array<string, mixed> $changes */
    public function updatePurchase(int $id, array $changes): void
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

        $this->db->statement('UPDATE material_purchases SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    public function setPurchaseLine(int $purchaseId, int $materialId, string $qty, string $unitCost): void
    {
        $this->db->statement(
            'INSERT INTO material_purchase_items (purchase_id, material_id, qty_ordered, unit_cost)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE qty_ordered = VALUES(qty_ordered), unit_cost = VALUES(unit_cost)',
            [$purchaseId, $materialId, $qty, $unitCost],
        );
    }

    public function removePurchaseLine(int $purchaseId, int $materialId): void
    {
        $this->db->statement(
            'DELETE FROM material_purchase_items WHERE purchase_id = ? AND material_id = ?',
            [$purchaseId, $materialId],
        );
    }

    public function addReceived(int $purchaseId, int $materialId, string $qty): void
    {
        $this->db->statement(
            'UPDATE material_purchase_items SET qty_received = qty_received + ? WHERE purchase_id = ? AND material_id = ?',
            [$qty, $purchaseId, $materialId],
        );
    }

    public function softDeletePurchase(int $id): void
    {
        $this->db->statement(
            'UPDATE material_purchases SET deleted_at = ? WHERE id = ?',
            [$this->clock->nowString(), $id],
        );
    }

    /* ------------------------------------------------------------------ runs */

    /**
     * @param array{status?: string, item?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function runs(array $filters = []): array
    {
        $where = ['r.deleted_at IS NULL'];
        $bindings = [];

        $status = strtoupper(trim($filters['status'] ?? ''));

        if ($status === 'OPEN') {
            $where[] = "r.status IN ('PLANNED','STARTED')";
        } elseif ($status !== '' && $status !== 'ALL') {
            $where[] = 'r.status = ?';
            $bindings[] = $status;
        }

        $item = trim($filters['item'] ?? '');

        if ($item !== '' && $item !== 'all') {
            $where[] = 'si.public_id = ?';
            $bindings[] = $item;
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(r.public_id LIKE ? OR si.item_name LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like);
        }

        return $this->db->select(
            'SELECT r.*, si.item_name, si.public_id AS item_public_id, si.sizes_csv,
                    w.name AS warehouse_name, w.public_id AS warehouse_public_id,
                    u.name AS owner_name, u.public_id AS owner_public_id,
                    (SELECT COUNT(*) FROM production_run_materials rm WHERE rm.run_id = r.id) AS line_count
               FROM production_runs r
               JOIN stock_items si ON si.id = r.stock_item_id
               LEFT JOIN warehouses w ON w.id = r.warehouse_id
               LEFT JOIN users u ON u.id = r.owner_user_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY r.created_at DESC, r.id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function findRun(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT r.*, si.item_name, si.public_id AS item_public_id, si.warehouse_id AS item_warehouse_id,
                    w.name AS warehouse_name, w.public_id AS warehouse_public_id,
                    u.name AS owner_name, u.public_id AS owner_public_id
               FROM production_runs r
               JOIN stock_items si ON si.id = r.stock_item_id
               LEFT JOIN warehouses w ON w.id = r.warehouse_id
               LEFT JOIN users u ON u.id = r.owner_user_id
              WHERE r.public_id = ? AND r.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function runLines(int $runId): array
    {
        return $this->db->select(
            'SELECT rm.*, m.public_id AS material_public_id, m.name AS material_name,
                    m.unit, m.available, m.on_hand
               FROM production_run_materials rm
               JOIN materials m ON m.id = rm.material_id
              WHERE rm.run_id = ?
              ORDER BY m.name ASC',
            [$runId],
        );
    }

    /** @return array{id: int, publicId: string} */
    public function createRun(int $stockItemId, ?int $warehouseId, int $qtyPlanned, string $notes, ?int $ownerId): array
    {
        $publicId = $this->ids->allocateGapFilling('production_runs', 'public_id', 'run-', 4, 1);

        $id = $this->db->insert(
            'INSERT INTO production_runs
                (public_id, stock_item_id, warehouse_id, qty_planned, status, notes, owner_user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $stockItemId,
                $warehouseId,
                $qtyPlanned,
                'PLANNED',
                $notes,
                $ownerId,
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );

        return ['id' => $id, 'publicId' => $publicId];
    }

    /** @param array<string, mixed> $changes */
    public function updateRun(int $id, array $changes): void
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

        $this->db->statement('UPDATE production_runs SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    /**
     * Freezes the recipe onto the run.
     *
     * A SNAPSHOT rather than a join to `product_materials`, because the recipe
     * can change next month and a run that happened in August has to keep saying
     * what it used in August — the same reason `order_items` freezes its prices.
     */
    public function snapshotRecipe(int $runId, int $materialId, string $qtyPerUnit, string $wastagePct): void
    {
        $this->db->statement(
            'INSERT INTO production_run_materials (run_id, material_id, qty_per_unit, wastage_pct)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE qty_per_unit = VALUES(qty_per_unit), wastage_pct = VALUES(wastage_pct)',
            [$runId, $materialId, $qtyPerUnit, $wastagePct],
        );
    }

    /**
     * Sets one of the run line's two quantities.
     *
     * Written as two whole statements rather than one with the column name
     * interpolated. There are exactly two columns this can ever touch, so the
     * dynamic form bought nothing — and a SQL string built by `sprintf` is one
     * a reader has to prove safe, and one no static check can read.
     */
    public function setRunLineQty(int $runId, int $materialId, string $column, string $qty): void
    {
        if ($column === 'qty_reserved') {
            $this->db->statement(
                'UPDATE production_run_materials SET qty_reserved = ? WHERE run_id = ? AND material_id = ?',
                [$qty, $runId, $materialId],
            );

            return;
        }

        if ($column === 'qty_consumed') {
            $this->db->statement(
                'UPDATE production_run_materials SET qty_consumed = ? WHERE run_id = ? AND material_id = ?',
                [$qty, $runId, $materialId],
            );
        }
    }

    public function softDeleteRun(int $id): void
    {
        $this->db->statement('UPDATE production_runs SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /** @return array<string, mixed> */
    public function runSummary(): array
    {
        $row = $this->db->selectOne(
            'SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status = \'PLANNED\' THEN 1 ELSE 0 END) AS planned,
                    SUM(CASE WHEN status = \'STARTED\' THEN 1 ELSE 0 END) AS started,
                    COALESCE(SUM(CASE WHEN status = \'DONE\' THEN qty_produced ELSE 0 END), 0) AS units_made
               FROM production_runs
              WHERE deleted_at IS NULL',
        );

        return $row ?? [];
    }
}
