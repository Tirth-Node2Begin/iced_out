<?php

declare(strict_types=1);

namespace Iced\Presenter;

/**
 * Materials, suppliers, purchases and production runs, rendered for the console.
 *
 * Quantities go out as PLAIN NUMERIC STRINGS with their trailing zeros trimmed —
 * "2.4", not "2.400" and not 2.4 as a float. Two reasons, and both bite:
 *
 *   · a float round-trip turns 2.4 into 2.3999999999999996 in the browser, and
 *     a register that prints that has lost the operator's trust for good;
 *   · the unit belongs beside the number and differs per material, so the value
 *     and its unit are separate fields rather than one pre-joined string the UI
 *     cannot align in a column.
 */
final class MaterialPresenter
{
    /** "2.400" → "2.4"; "12.000" → "12". Keeps a column of numbers readable. */
    public static function qty(mixed $value): string
    {
        $number = (float) $value;

        /* Three decimals is the column's own precision — formatting to more
           would invent digits the database never stored. */
        $text = number_format($number, 3, '.', '');

        return str_contains($text, '.') ? rtrim(rtrim($text, '0'), '.') : $text;
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function material(array $row): array
    {
        $available = (float) ($row['available'] ?? 0);
        $reorder = (float) ($row['reorder_point'] ?? 0);

        return [
            'id' => (string) $row['public_id'],
            'code' => (string) $row['code'],
            'name' => (string) $row['name'],
            'kind' => (string) $row['kind'],
            'unit' => (string) $row['unit'],
            'onHand' => self::qty($row['on_hand'] ?? 0),
            'reserved' => self::qty($row['reserved'] ?? 0),
            'available' => self::qty($available),
            'reorderPoint' => self::qty($reorder),
            'unitCost' => '₹' . Format::groupIndian((int) round((float) ($row['unit_cost'] ?? 0))),
            'unitCostRaw' => (float) ($row['unit_cost'] ?? 0),
            'stockValue' => '₹' . Format::groupIndian(
                (int) round((float) ($row['on_hand'] ?? 0) * (float) ($row['unit_cost'] ?? 0)),
            ),
            'supplier' => $this->ref($row, 'supplier_public_id', 'supplier_name'),
            'leadTimeDays' => (int) ($row['lead_time_days'] ?? 0),
            'warehouse' => $this->ref($row, 'warehouse_public_id', 'warehouse_name'),
            'status' => (string) $row['status'],
            'notes' => (string) ($row['notes'] ?? ''),
            /* How many recipes call for it — what makes deleting one dangerous. */
            'usedIn' => (int) ($row['used_in'] ?? 0),
            /**
             * The one derived word the register sorts and filters on.
             *
             * `Out` beats `At risk`: nothing left is a harder fact than nearly
             * nothing left. A reorder point of zero means "do not warn", so a
             * material with stock and no point set is simply `Healthy`.
             */
            'state' => $available <= 0 ? 'Out' : ($reorder > 0 && $available <= $reorder ? 'At risk' : 'Healthy'),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function supplier(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'contactName' => (string) $row['contact_name'],
            'email' => (string) $row['email'],
            'phone' => (string) $row['phone'],
            'city' => (string) $row['city'],
            'country' => (string) $row['country'],
            'leadTimeDays' => (int) $row['lead_time_days'],
            'leadTime' => (int) $row['lead_time_days'] === 0
                ? 'Not recorded'
                : sprintf('%d day%s', (int) $row['lead_time_days'], (int) $row['lead_time_days'] === 1 ? '' : 's'),
            'status' => (string) $row['status'] === 'ACTIVE' ? 'Active' : 'Archived',
            'statusCode' => (string) $row['status'],
            'notes' => (string) ($row['notes'] ?? ''),
            'materialsCount' => (int) ($row['materials_count'] ?? 0),
            'openPurchases' => (int) ($row['open_purchases'] ?? 0),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function purchase(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'supplier' => $this->ref($row, 'supplier_public_id', 'supplier_name'),
            'status' => (string) $row['status'],
            'orderedOn' => $this->date($row['ordered_on'] ?? null),
            'expectedOn' => $this->date($row['expected_on'] ?? null),
            'receivedOn' => $this->date($row['received_on'] ?? null),
            'currency' => (string) $row['currency'],
            'notes' => (string) ($row['notes'] ?? ''),
            'owner' => $this->ref($row, 'owner_public_id', 'owner_name'),
            'lineCount' => (int) ($row['line_count'] ?? 0),
            'totalCost' => '₹' . Format::groupIndian((int) round((float) ($row['total_cost'] ?? 0))),
            'qtyOrdered' => self::qty($row['qty_ordered'] ?? 0),
            'qtyReceived' => self::qty($row['qty_received'] ?? 0),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function purchaseLine(array $row): array
    {
        $ordered = (float) $row['qty_ordered'];
        $received = (float) $row['qty_received'];

        return [
            'materialId' => (string) $row['material_public_id'],
            'material' => (string) $row['material_name'],
            'code' => (string) ($row['code'] ?? ''),
            'unit' => (string) $row['unit'],
            'ordered' => self::qty($ordered),
            'received' => self::qty($received),
            /* What is still owed. Never negative: an over-delivery is a fact
               about the receipt, not a debt the supplier owes back. */
            'outstanding' => self::qty(max(0, $ordered - $received)),
            'unitCost' => '₹' . Format::groupIndian((int) round((float) $row['unit_cost'])),
            'unitCostRaw' => (float) $row['unit_cost'],
            'lineTotal' => '₹' . Format::groupIndian((int) round($ordered * (float) $row['unit_cost'])),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function run(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'item' => [
                'id' => (string) ($row['item_public_id'] ?? ''),
                'name' => (string) ($row['item_name'] ?? ''),
            ],
            'warehouse' => $this->ref($row, 'warehouse_public_id', 'warehouse_name'),
            'qtyPlanned' => (int) $row['qty_planned'],
            'qtyProduced' => (int) $row['qty_produced'],
            'status' => (string) $row['status'],
            'startedAt' => $this->stamp($row['started_at'] ?? null),
            'completedAt' => $this->stamp($row['completed_at'] ?? null),
            'notes' => (string) ($row['notes'] ?? ''),
            'owner' => $this->ref($row, 'owner_public_id', 'owner_name'),
            'lineCount' => (int) ($row['line_count'] ?? 0),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
        ];
    }

    /**
     * A run's material line, with what it needs for the quantity being made.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function runLine(array $row, int $units): array
    {
        $needed = self::required((string) $row['qty_per_unit'], (string) $row['wastage_pct'], $units);
        $available = (float) ($row['available'] ?? 0);
        $reserved = (float) ($row['qty_reserved'] ?? 0);

        return [
            'materialId' => (string) $row['material_public_id'],
            'material' => (string) $row['material_name'],
            'unit' => (string) $row['unit'],
            'perUnit' => self::qty($row['qty_per_unit']),
            'wastagePct' => (float) $row['wastage_pct'],
            'required' => self::qty($needed),
            'reserved' => self::qty($reserved),
            'consumed' => self::qty($row['qty_consumed'] ?? 0),
            'available' => self::qty($available),
            /* Whether this line can be met RIGHT NOW. What the run already holds
               counts towards it — otherwise a started run would report itself
               short of the very material it is holding. */
            'short' => $available + $reserved < (float) $needed,
        ];
    }

    /**
     * What a run of `$units` needs of one material: the recipe quantity plus its
     * cutting loss, rounded UP to the material's own precision.
     *
     * Up, not nearest: a run that needs 96.0004 metres and reserves 96.000 is
     * four ten-thousandths short, and the shortage only shows on the cutting
     * table when it is too late to do anything about it.
     */
    public static function required(string $qtyPerUnit, string $wastagePct, int $units): string
    {
        $per = (float) $qtyPerUnit * (1 + (float) $wastagePct / 100);
        $total = $per * max(0, $units);

        return number_format(ceil($total * 1000) / 1000, 3, '.', '');
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function recipeLine(array $row): array
    {
        return [
            'materialId' => (string) $row['material_public_id'],
            'material' => (string) $row['material_name'],
            'code' => (string) ($row['code'] ?? ''),
            'unit' => (string) $row['unit'],
            'perUnit' => self::qty($row['qty_per_unit']),
            'wastagePct' => (float) $row['wastage_pct'],
            /* What one finished piece actually draws down, loss included — the
               number an operator plans with. */
            'effective' => self::qty(self::required((string) $row['qty_per_unit'], (string) $row['wastage_pct'], 1)),
            'available' => self::qty($row['available'] ?? 0),
            'unitCost' => '₹' . Format::groupIndian((int) round((float) ($row['unit_cost'] ?? 0))),
            'lineCost' => '₹' . Format::groupIndian((int) round(
                (float) self::required((string) $row['qty_per_unit'], (string) $row['wastage_pct'], 1)
                * (float) ($row['unit_cost'] ?? 0),
            )),
            'note' => (string) ($row['note'] ?? ''),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function movement(array $row): array
    {
        return [
            'type' => (string) $row['type'],
            'qty' => self::qty($row['qty']),
            'onHandAfter' => self::qty($row['on_hand_after'] ?? 0),
            'reservedAfter' => self::qty($row['reserved_after'] ?? 0),
            'reference' => trim(((string) $row['reference_type']) . ' ' . ((string) $row['reference_id'])),
            'note' => (string) $row['note'],
            'actor' => (string) ($row['actor_name'] ?? ''),
            'at' => $this->stamp($row['created_at'] ?? null),
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function map(array $rows, string $kind): array
    {
        return array_map(fn (array $row): array => $this->{$kind}($row), $rows);
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array{id: string, name: string}|null
     */
    private function ref(array $row, string $idKey, string $nameKey): ?array
    {
        $id = $row[$idKey] ?? null;

        if ($id === null || (string) $id === '') {
            return null;
        }

        return ['id' => (string) $id, 'name' => (string) ($row[$nameKey] ?? '')];
    }

    private function stamp(mixed $stored): ?string
    {
        if ($stored === null || (string) $stored === '') {
            return null;
        }

        $moment = Format::parse((string) $stored);

        return $moment === null ? null : Format::sentAt($moment);
    }

    private function date(mixed $stored): ?string
    {
        if ($stored === null || (string) $stored === '') {
            return null;
        }

        return substr((string) $stored, 0, 10);
    }
}
