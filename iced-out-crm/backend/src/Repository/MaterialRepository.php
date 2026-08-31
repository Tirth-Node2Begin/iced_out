<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;
use Iced\Support\IdAllocator;

/**
 * Materials, suppliers and the bill of materials.
 *
 * Reads only, plus the writes that are NOT quantity changes — a name, a reorder
 * point, a supplier. Every write that moves `on_hand` or `reserved` goes through
 * `MaterialService`, so the ledger cannot be bypassed.
 */
final class MaterialRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly IdAllocator $ids,
    ) {
    }

    /* ------------------------------------------------------------ materials */

    /**
     * @param array{kind?: string, supplier?: string, status?: string, risk?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['m.deleted_at IS NULL'];
        $bindings = [];

        $kind = strtoupper(trim($filters['kind'] ?? ''));

        if ($kind !== '' && $kind !== 'ALL') {
            $where[] = 'm.kind = ?';
            $bindings[] = $kind;
        }

        $status = strtoupper(trim($filters['status'] ?? ''));

        if ($status !== '' && $status !== 'ALL') {
            $where[] = 'm.status = ?';
            $bindings[] = $status;
        }

        $supplier = trim($filters['supplier'] ?? '');

        if ($supplier === 'none') {
            $where[] = 'm.supplier_id IS NULL';
        } elseif ($supplier !== '' && $supplier !== 'all') {
            $where[] = 's.public_id = ?';
            $bindings[] = $supplier;
        }

        /* "At risk" is free stock at or under the reorder point — and only where
           a point has been set, because 0 means "do not warn" rather than
           "warn always". */
        if (($filters['risk'] ?? '') === 'true') {
            $where[] = 'm.reorder_point > 0 AND m.available <= m.reorder_point';
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(m.public_id LIKE ? OR m.name LIKE ? OR m.code LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT m.*,
                    s.name AS supplier_name, s.public_id AS supplier_public_id, s.lead_time_days,
                    w.name AS warehouse_name, w.public_id AS warehouse_public_id,
                    (SELECT COUNT(*) FROM product_materials pm WHERE pm.material_id = m.id) AS used_in
               FROM materials m
               LEFT JOIN suppliers s ON s.id = m.supplier_id
               LEFT JOIN warehouses w ON w.id = m.warehouse_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY m.kind ASC, m.name ASC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT m.*,
                    s.name AS supplier_name, s.public_id AS supplier_public_id, s.lead_time_days,
                    w.name AS warehouse_name, w.public_id AS warehouse_public_id,
                    (SELECT COUNT(*) FROM product_materials pm WHERE pm.material_id = m.id) AS used_in
               FROM materials m
               LEFT JOIN suppliers s ON s.id = m.supplier_id
               LEFT JOIN warehouses w ON w.id = m.warehouse_id
              WHERE m.public_id = ? AND m.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    /**
     * @param array{code: string, name: string, kind: string, unit: string,
     *              reorderPoint: string, unitCost: string, supplierId: int|null,
     *              warehouseId: int|null, notes: string} $input
     *
     * @return array{id: int, publicId: string}
     */
    public function create(array $input): array
    {
        $publicId = $this->ids->allocateGapFilling('materials', 'public_id', 'mat-', 4, 1);

        /* on_hand starts at zero and stays there until something RECEIVES it.
           Letting the create form seed a quantity would put stock in the
           register with no movement row behind it — the one thing this module
           exists to prevent. */
        $id = $this->db->insert(
            'INSERT INTO materials
                (public_id, code, name, kind, unit, reorder_point, unit_cost, supplier_id,
                 warehouse_id, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $input['code'],
                $input['name'],
                $input['kind'],
                $input['unit'],
                $input['reorderPoint'],
                $input['unitCost'],
                $input['supplierId'],
                $input['warehouseId'],
                $input['notes'],
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

        $this->db->statement('UPDATE materials SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    public function softDelete(int $id): void
    {
        $this->db->statement('UPDATE materials SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /**
     * Everything the register header counts, in one pass.
     *
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        $row = $this->db->selectOne(
            'SELECT COUNT(*) AS total,
                    SUM(CASE WHEN reorder_point > 0 AND available <= reorder_point THEN 1 ELSE 0 END) AS at_risk,
                    SUM(CASE WHEN available <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
                    COALESCE(SUM(on_hand * unit_cost), 0) AS stock_value
               FROM materials
              WHERE deleted_at IS NULL AND status = \'ACTIVE\'',
        );

        return $row ?? [];
    }

    /** @return list<array<string, mixed>> */
    public function movements(int $materialId, int $limit = 60): array
    {
        return $this->db->select(
            'SELECT mm.*, u.name AS actor_name
               FROM material_movements mm
               LEFT JOIN users u ON u.id = mm.actor_id
              WHERE mm.material_id = ?
              ORDER BY mm.created_at DESC, mm.id DESC
              LIMIT ' . max(1, min($limit, 200)),
            [$materialId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function options(): array
    {
        return $this->db->select(
            'SELECT public_id, name, unit, code, available
               FROM materials
              WHERE deleted_at IS NULL AND status = \'ACTIVE\'
              ORDER BY name ASC',
        );
    }

    /* ------------------------------------------------------------ suppliers */

    /**
     * @param array{status?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function suppliers(array $filters = []): array
    {
        $where = ['s.deleted_at IS NULL'];
        $bindings = [];

        $status = strtoupper(trim($filters['status'] ?? ''));

        if ($status !== '' && $status !== 'ALL') {
            $where[] = 's.status = ?';
            $bindings[] = $status;
        }

        $q = trim($filters['q'] ?? '');

        if ($q !== '') {
            $where[] = '(s.public_id LIKE ? OR s.name LIKE ? OR s.email LIKE ? OR s.contact_name LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT s.*,
                    (SELECT COUNT(*) FROM materials m
                      WHERE m.supplier_id = s.id AND m.deleted_at IS NULL) AS materials_count,
                    (SELECT COUNT(*) FROM material_purchases p
                      WHERE p.supplier_id = s.id AND p.deleted_at IS NULL
                        AND p.status IN (\'ORDERED\',\'PARTIAL\')) AS open_purchases
               FROM suppliers s
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY s.name ASC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function findSupplier(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM suppliers WHERE public_id = ? AND deleted_at IS NULL LIMIT 1',
            [$publicId],
        );
    }

    /** @return array<string, mixed>|null */
    public function findSupplierByName(string $name): ?array
    {
        $normalized = mb_strtolower(trim($name));

        if ($normalized === '') {
            return null;
        }

        return $this->db->selectOne(
            'SELECT * FROM suppliers WHERE name_normalized = ? AND deleted_at IS NULL LIMIT 1',
            [$normalized],
        );
    }

    /**
     * @param array{name: string, contactName: string, email: string, phone: string,
     *              city: string, country: string, leadTimeDays: int, notes: string} $input
     *
     * @return array{id: int, publicId: string}
     */
    public function createSupplier(array $input): array
    {
        $publicId = $this->ids->allocateGapFilling('suppliers', 'public_id', 'sup-', 2, 1);

        $id = $this->db->insert(
            'INSERT INTO suppliers
                (public_id, name, name_normalized, contact_name, email, phone, city, country,
                 lead_time_days, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $input['name'],
                mb_strtolower(trim($input['name'])),
                $input['contactName'],
                $input['email'],
                $input['phone'],
                $input['city'],
                $input['country'],
                $input['leadTimeDays'],
                $input['notes'],
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );

        return ['id' => $id, 'publicId' => $publicId];
    }

    /** @param array<string, mixed> $changes */
    public function updateSupplier(int $id, array $changes): void
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

        $this->db->statement('UPDATE suppliers SET ' . implode(', ', $sets) . ' WHERE id = ?', $bindings);
    }

    public function softDeleteSupplier(int $id): void
    {
        $this->db->statement('UPDATE suppliers SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }

    /* ---------------------------------------------------------------- the BOM */

    /**
     * What one unit of a stock item is made of.
     *
     * @return list<array<string, mixed>>
     */
    public function recipe(int $stockItemId): array
    {
        return $this->db->select(
            'SELECT pm.*, m.public_id AS material_public_id, m.name AS material_name,
                    m.unit, m.available, m.unit_cost, m.code
               FROM product_materials pm
               JOIN materials m ON m.id = pm.material_id
              WHERE pm.stock_item_id = ? AND m.deleted_at IS NULL
              ORDER BY m.kind ASC, m.name ASC',
            [$stockItemId],
        );
    }

    /** Which stock items call for this material. */
    public function usedIn(int $materialId): array
    {
        return $this->db->select(
            'SELECT pm.qty_per_unit, pm.wastage_pct,
                    si.public_id AS item_public_id, si.item_name
               FROM product_materials pm
               JOIN stock_items si ON si.id = pm.stock_item_id
              WHERE pm.material_id = ? AND si.deleted_at IS NULL
              ORDER BY si.item_name ASC',
            [$materialId],
        );
    }

    /** Upsert, because a recipe line is identified by its pair, not by an id. */
    public function setRecipeLine(int $stockItemId, int $materialId, string $qtyPerUnit, string $wastagePct, string $note): void
    {
        $this->db->statement(
            'INSERT INTO product_materials (stock_item_id, material_id, qty_per_unit, wastage_pct, note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE qty_per_unit = VALUES(qty_per_unit),
                                     wastage_pct = VALUES(wastage_pct),
                                     note = VALUES(note),
                                     updated_at = VALUES(updated_at)',
            [
                $stockItemId,
                $materialId,
                $qtyPerUnit,
                $wastagePct,
                $note,
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );
    }

    public function removeRecipeLine(int $stockItemId, int $materialId): void
    {
        $this->db->statement(
            'DELETE FROM product_materials WHERE stock_item_id = ? AND material_id = ?',
            [$stockItemId, $materialId],
        );
    }
}
