<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

final class ShipmentRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    /**
     * @param array{tab?: string, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['1 = 1'];
        $bindings = [];

        $tab = $filters['tab'] ?? 'all';

        if ($tab === 'active') {
            $where[] = "s.status IN ('Dispatched','In transit')";
        } elseif ($tab === 'failed') {
            $where[] = "s.status = 'Failed'";
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(s.public_id LIKE ? OR s.order_number LIKE ? OR s.awb LIKE ? OR s.destination LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT s.*, n.attempts AS ndr_attempts, n.status AS ndr_status
               FROM shipments s
               LEFT JOIN ndr_cases n ON n.shipment_id = s.id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY s.created_at DESC, s.id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function findByPublicId(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT s.*, n.attempts AS ndr_attempts, n.status AS ndr_status
               FROM shipments s
               LEFT JOIN ndr_cases n ON n.shipment_id = s.id
              WHERE s.public_id = ? LIMIT 1',
            [$publicId],
        );
    }

    /** @return array<string, mixed>|null */
    public function findByToken(string $token): ?array
    {
        return $this->db->selectOne('SELECT * FROM shipments WHERE tracking_token = ? LIMIT 1', [$token]);
    }

    /** @return list<array<string, mixed>> */
    public function events(int $shipmentId): array
    {
        return $this->db->select(
            'SELECT label, detail, time_label, is_complete, source FROM shipment_events
              WHERE shipment_id = ? ORDER BY position, id',
            [$shipmentId],
        );
    }

    /** @param array<string, mixed> $data */
    public function create(array $data): int
    {
        return $this->db->insert(
            'INSERT INTO shipments
                (public_id, order_id, order_number, provider, awb, destination, dispatched_label,
                 promise_label, status, tracking_token, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $data['public_id'], $data['order_id'], $data['order_number'], $data['provider'], $data['awb'],
                $data['destination'], $data['dispatched_label'], $data['promise_label'], $data['status'],
                $data['tracking_token'], $this->clock->nowString(),
            ],
        );
    }

    public function setStatus(int $shipmentId, string $status, ?string $failReason, ?string $handling): void
    {
        $this->db->statement(
            'UPDATE shipments SET status = ?, fail_reason = ?, handling = ?, updated_at = ? WHERE id = ?',
            [$status, $failReason, $handling, $this->clock->nowString(), $shipmentId],
        );
    }

    public function setHandling(int $shipmentId, ?string $handling): void
    {
        $this->db->statement(
            'UPDATE shipments SET handling = ?, updated_at = ? WHERE id = ?',
            [$handling, $this->clock->nowString(), $shipmentId],
        );
    }

    public function appendEvent(int $shipmentId, string $label, string $detail, bool $complete, string $source = 'internal'): void
    {
        $row = $this->db->selectOne('SELECT COALESCE(MAX(position), -1) AS p FROM shipment_events WHERE shipment_id = ?', [$shipmentId]);

        $this->db->statement(
            'INSERT INTO shipment_events (shipment_id, label, detail, time_label, is_complete, position, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $shipmentId,
                $label,
                $detail,
                \Iced\Presenter\Format::ledgerStamp($this->clock->now()),
                $complete ? 1 : 0,
                ($row === null ? -1 : (int) $row['p']) + 1,
                $source,
                $this->clock->nowString(),
            ],
        );
    }

    /** Replaces the cached external tail; internal milestones are never touched. */
    public function replaceExternalEvents(int $shipmentId): void
    {
        $this->db->statement("DELETE FROM shipment_events WHERE shipment_id = ? AND source = 'external'", [$shipmentId]);
    }

    /**
     * Caches one courier scan.
     *
     * Separate from `appendEvent` for one reason, and it matters: that method
     * stamps the row with `now()`, because an internal milestone happens at the
     * moment somebody clicks it. A courier scan happened when the COURIER says
     * it happened — often hours earlier, sometimes in a different order than it
     * reached us — so its own timestamp is carried through verbatim. Stamping
     * these with `now()` would make every scan on a re-poll appear to have just
     * occurred, and a delivery timeline that reorders itself on refresh is
     * worse than no timeline.
     *
     * `position` is passed in rather than derived, so the tail keeps the order
     * the provider sorted it into.
     */
    public function appendExternalEvent(
        int $shipmentId,
        string $label,
        string $detail,
        string $timeLabel,
        bool $complete,
        int $position,
        ?string $externalRef = null,
    ): void {
        $this->db->statement(
            'INSERT INTO shipment_events
                (shipment_id, label, detail, time_label, is_complete, position, source, external_ref, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $shipmentId,
                mb_substr($label, 0, 80),
                mb_substr($detail, 0, 255),
                mb_substr($timeLabel, 0, 40),
                $complete ? 1 : 0,
                $position,
                'external',
                $externalRef === null ? null : mb_substr($externalRef, 0, 120),
                $this->clock->nowString(),
            ],
        );
    }

    /**
     * The prefix and floor come from settings; the value itself is always
     * derived from what the table holds, so raising the floor can never mint a
     * duplicate.
     */
    public function nextPublicId(): string
    {
        $series = $this->settings->series('shipment', 'shp-', 1051);
        $row = $this->db->selectOne(
            'SELECT public_id FROM shipments WHERE public_id LIKE ? ORDER BY public_id DESC LIMIT 1',
            [$series['prefix'] . '%'],
        );

        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['public_id']);
        $next = max($series['from'], $highest + 1);

        return $series['prefix'] . ($series['width'] > 0 ? str_pad((string) $next, $series['width'], '0', STR_PAD_LEFT) : (string) $next);
    }

    /* ---------------------------------------------------------------- NDR */

    public function bumpNdrAttempt(int $shipmentId, string $reason): int
    {
        $case = $this->db->selectOne('SELECT id, attempts FROM ndr_cases WHERE shipment_id = ?', [$shipmentId]);

        if ($case === null) {
            $this->db->statement(
                "INSERT INTO ndr_cases (shipment_id, reason, attempts, status) VALUES (?, ?, 1, 'Reattempting')",
                [$shipmentId, $reason],
            );

            return 1;
        }

        $attempts = (int) $case['attempts'] + 1;

        $this->db->statement(
            'UPDATE ndr_cases SET attempts = ?, status = ?, reason = ?, updated_at = ? WHERE id = ?',
            [$attempts, $attempts >= 3 ? 'RTO' : 'Reattempting', $reason, $this->clock->nowString(), (int) $case['id']],
        );

        return $attempts;
    }

    public function closeNdr(int $shipmentId, string $status): void
    {
        $this->db->statement(
            'UPDATE ndr_cases SET status = ?, updated_at = ? WHERE shipment_id = ?',
            [$status, $this->clock->nowString(), $shipmentId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function ndrCases(): array
    {
        return $this->db->select(
            "SELECT n.*, s.public_id, s.order_number, s.provider, s.destination, s.status AS shipment_status, s.handling
               FROM ndr_cases n JOIN shipments s ON s.id = n.shipment_id
              WHERE n.status <> 'Closed' ORDER BY n.updated_at DESC",
        );
    }

    /* ------------------------------------------------------------ pickups */

    /** @return list<array<string, mixed>> */
    public function pickups(): array
    {
        return $this->db->select('SELECT * FROM courier_pickups ORDER BY created_at DESC, id DESC');
    }

    public function createPickup(string $publicId, string $provider, int $parcels, string $label): void
    {
        $this->db->statement(
            "INSERT INTO courier_pickups (public_id, provider, parcels, pickup_label, status) VALUES (?, ?, ?, ?, 'Open')",
            [$publicId, $provider, $parcels, $label],
        );
    }

    public function nextPickupId(): string
    {
        $series = $this->settings->series('pickup', 'PICK-', 413, 4);
        $row = $this->db->selectOne('SELECT public_id FROM courier_pickups ORDER BY public_id DESC LIMIT 1');
        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['public_id']);

        return $series['prefix'] . str_pad((string) max($series['from'], $highest + 1), max(1, $series['width']), '0', STR_PAD_LEFT);
    }

    /** @return array<string, mixed>|null */
    public function findPickup(string $publicId): ?array
    {
        return $this->db->selectOne('SELECT * FROM courier_pickups WHERE public_id = ? LIMIT 1', [$publicId]);
    }

    public function handOverPickup(string $publicId): void
    {
        $this->db->statement(
            "UPDATE courier_pickups SET status = 'Handed over', updated_at = ? WHERE public_id = ?",
            [$this->clock->nowString(), $publicId],
        );
    }
}
