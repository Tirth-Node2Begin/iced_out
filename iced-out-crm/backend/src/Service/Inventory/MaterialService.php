<?php

declare(strict_types=1);

namespace Iced\Service\Inventory;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Support\Clock;

/**
 * The only writer of material quantities.
 *
 * `StockService` is the same thing for finished goods, and this deliberately
 * mirrors it: every method that moves a number appends a `material_movements`
 * row, so the ledger is always the complete story of how a quantity got where
 * it is. Nothing else in the codebase touches `materials.on_hand` or
 * `materials.reserved`.
 *
 * `available` is never written — it is a generated column, `on_hand - reserved`.
 *
 * Quantities are strings on the way in and out. They are DECIMAL(12,3) in the
 * database, and a float round-trip through PHP turns 2.4 into 2.3999999999999,
 * which after four hundred hoodies is a metre of fleece the ledger cannot
 * account for. `bcmath` is not assumed present, so the arithmetic below is done
 * in integer thousandths and formatted back at the edges.
 */
final class MaterialService
{
    /** DECIMAL(12,3) — three decimal places, so one unit is 1000 thousandths. */
    private const SCALE = 1000;

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** "2.4" → 2400. The one place a quantity becomes an integer. */
    public static function toMilli(string|float|int $qty): int
    {
        return (int) round((float) $qty * self::SCALE);
    }

    /** 2400 → "2.400", the shape the DECIMAL column takes. */
    public static function fromMilli(int $milli): string
    {
        return number_format($milli / self::SCALE, 3, '.', '');
    }

    /**
     * Materials arriving from a supplier.
     *
     * The unit cost is written onto the material as well, because the LAST price
     * paid is the one an operator means by "what does this cost" — a purchase
     * six months ago at a different rate is history, and it is still in the
     * purchase record if anyone needs it.
     */
    public function receive(
        int $materialId,
        string $qty,
        string $referenceType,
        string $referenceId,
        ?string $unitCost,
        ?int $actorId,
    ): void {
        $milli = self::toMilli($qty);

        if ($milli <= 0) {
            throw new ConflictException('ICE-INV-409', 'A receipt has to be for more than nothing.');
        }

        $row = $this->lock($materialId);
        $onHand = self::toMilli((string) $row['on_hand']) + $milli;

        $this->db->statement(
            'UPDATE materials SET on_hand = ?, unit_cost = COALESCE(?, unit_cost), version = version + 1 WHERE id = ?',
            [self::fromMilli($onHand), $unitCost, $materialId],
        );

        $this->movement(
            $materialId,
            'RECEIPT',
            self::fromMilli($milli),
            self::fromMilli($onHand),
            (string) $row['reserved'],
            $referenceType,
            $referenceId,
            '',
            $actorId,
        );
    }

    /**
     * Holds material for a run that has started.
     *
     * A hold rather than a consumption, because a started run has not used
     * anything yet — it has only made a claim nobody else may take. That claim
     * is what stops two runs promising the same fifty metres.
     *
     * @throws ConflictException when there is not enough left unclaimed
     */
    public function reserve(int $materialId, string $qty, string $referenceType, string $referenceId, ?int $actorId): void
    {
        $milli = self::toMilli($qty);

        if ($milli <= 0) {
            return;
        }

        $row = $this->lock($materialId);
        $onHand = self::toMilli((string) $row['on_hand']);
        $reserved = self::toMilli((string) $row['reserved']);

        if ($reserved + $milli > $onHand) {
            throw new ConflictException('ICE-INV-409', sprintf(
                'There is not enough %s left: %s %s free, %s needed.',
                (string) $row['name'],
                self::fromMilli($onHand - $reserved),
                (string) $row['unit'],
                self::fromMilli($milli),
            ));
        }

        $this->db->statement(
            'UPDATE materials SET reserved = ?, version = version + 1 WHERE id = ?',
            [self::fromMilli($reserved + $milli), $materialId],
        );

        $this->movement(
            $materialId,
            'RESERVE',
            /* Zero: a hold does not change what is ON HAND, only what is spoken
               for. The ledger's `qty` column means "what this did to on_hand",
               and saying otherwise here would make the column un-summable. */
            '0.000',
            (string) $row['on_hand'],
            self::fromMilli($reserved + $milli),
            $referenceType,
            $referenceId,
            '',
            $actorId,
        );
    }

    /** Gives a hold back — a run cancelled, or produced fewer units than planned. */
    public function release(int $materialId, string $qty, string $referenceType, string $referenceId, ?int $actorId): void
    {
        $milli = self::toMilli($qty);

        if ($milli <= 0) {
            return;
        }

        $row = $this->lock($materialId);
        /* Never below zero, even if the caller's arithmetic disagrees with the
           row: a negative reservation is a broken invariant that would then
           make everything else look available. */
        $reserved = max(0, self::toMilli((string) $row['reserved']) - $milli);

        $this->db->statement(
            'UPDATE materials SET reserved = ?, version = version + 1 WHERE id = ?',
            [self::fromMilli($reserved), $materialId],
        );

        $this->movement(
            $materialId,
            'RELEASE',
            '0.000',
            (string) $row['on_hand'],
            self::fromMilli($reserved),
            $referenceType,
            $referenceId,
            '',
            $actorId,
        );
    }

    /**
     * A held quantity actually used up: `on_hand` and `reserved` both come down.
     *
     * The same shape as `StockService::confirmReservationsForOrder` — a hold
     * becoming a fact — and for the same reason: the two numbers have to move
     * together or the difference between them stops meaning anything.
     */
    public function consumeReserved(int $materialId, string $qty, string $referenceType, string $referenceId, ?int $actorId): void
    {
        $milli = self::toMilli($qty);

        if ($milli <= 0) {
            return;
        }

        $row = $this->lock($materialId);
        $onHand = max(0, self::toMilli((string) $row['on_hand']) - $milli);
        $reserved = max(0, self::toMilli((string) $row['reserved']) - $milli);

        $this->db->statement(
            'UPDATE materials SET on_hand = ?, reserved = ?, version = version + 1 WHERE id = ?',
            [self::fromMilli($onHand), self::fromMilli($reserved), $materialId],
        );

        $this->movement(
            $materialId,
            'CONSUME',
            self::fromMilli(-$milli),
            self::fromMilli($onHand),
            self::fromMilli($reserved),
            $referenceType,
            $referenceId,
            '',
            $actorId,
        );
    }

    /**
     * A count corrected by hand — a stocktake, a damaged roll, an offcut found.
     *
     * `reason` is required by the caller rather than optional, because an
     * adjustment with no reason is the one ledger entry nobody can ever explain
     * afterwards.
     */
    public function adjust(int $materialId, string $newOnHand, string $reason, ?int $actorId): void
    {
        $target = max(0, self::toMilli($newOnHand));
        $row = $this->lock($materialId);
        $current = self::toMilli((string) $row['on_hand']);
        $reserved = self::toMilli((string) $row['reserved']);

        if ($target === $current) {
            return;
        }

        if ($target < $reserved) {
            throw new ConflictException('ICE-INV-409', sprintf(
                'That would leave less %s on hand than is already promised to a run (%s %s held).',
                (string) $row['name'],
                self::fromMilli($reserved),
                (string) $row['unit'],
            ));
        }

        $this->db->statement(
            'UPDATE materials SET on_hand = ?, version = version + 1 WHERE id = ?',
            [self::fromMilli($target), $materialId],
        );

        $delta = $target - $current;

        $this->movement(
            $materialId,
            $delta > 0 ? 'ADJUST_UP' : 'ADJUST_DOWN',
            self::fromMilli($delta),
            self::fromMilli($target),
            self::fromMilli($reserved),
            'manual',
            '',
            $reason,
            $actorId,
        );
    }

    /**
     * Stock written off — spoilt, mis-cut, or returned to the supplier.
     *
     * Distinct from an ADJUST_DOWN on purpose: an adjustment says the count was
     * wrong, a wastage says the count was right and the material is gone. A
     * month of the two mixed together cannot tell you what the cutting table
     * costs.
     */
    public function writeOff(int $materialId, string $qty, string $type, string $reason, ?int $actorId): void
    {
        $milli = self::toMilli($qty);

        if ($milli <= 0) {
            throw new ConflictException('ICE-INV-409', 'A write-off has to be for more than nothing.');
        }

        $row = $this->lock($materialId);
        $onHand = self::toMilli((string) $row['on_hand']);
        $reserved = self::toMilli((string) $row['reserved']);

        if ($onHand - $milli < $reserved) {
            throw new ConflictException('ICE-INV-409', sprintf(
                'Only %s %s of %s is free — the rest is promised to a run.',
                self::fromMilli($onHand - $reserved),
                (string) $row['unit'],
                (string) $row['name'],
            ));
        }

        $this->db->statement(
            'UPDATE materials SET on_hand = ?, version = version + 1 WHERE id = ?',
            [self::fromMilli($onHand - $milli), $materialId],
        );

        $this->movement(
            $materialId,
            $type === 'RETURN_OUT' ? 'RETURN_OUT' : 'WASTAGE',
            self::fromMilli(-$milli),
            self::fromMilli($onHand - $milli),
            self::fromMilli($reserved),
            'manual',
            '',
            $reason,
            $actorId,
        );
    }

    /**
     * The row, locked for update.
     *
     * `FOR UPDATE` and not a plain read: two production runs starting at the
     * same moment would otherwise both read the same free quantity and both
     * decide there was enough.
     *
     * @return array<string, mixed>
     */
    private function lock(int $materialId): array
    {
        $row = $this->db->selectOne(
            'SELECT id, name, unit, on_hand, reserved FROM materials WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
            [$materialId],
        );

        if ($row === null) {
            throw new ConflictException('ICE-INV-409', 'That material is no longer in the register.');
        }

        return $row;
    }

    private function movement(
        int $materialId,
        string $type,
        string $qty,
        string $onHandAfter,
        string $reservedAfter,
        string $referenceType,
        string $referenceId,
        string $note,
        ?int $actorId,
    ): void {
        $this->db->insert(
            'INSERT INTO material_movements
                (material_id, type, qty, on_hand_after, reserved_after, reference_type, reference_id, note, actor_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $materialId,
                $type,
                $qty,
                $onHandAfter,
                $reservedAfter,
                $referenceType,
                $referenceId,
                mb_substr($note, 0, 190),
                $actorId,
                $this->clock->nowString(),
            ],
        );
    }
}
