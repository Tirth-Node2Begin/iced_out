<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\DashboardPresenter;
use Iced\Repository\DashboardRepository;
use Iced\Support\Clock;
use Iced\Support\Json;

/**
 * Spec §8.29 — console analytics (3 endpoints), permission
 * `reports.operational.view`.
 *
 * Every tally is counted from the registers rather than kept as a running
 * total, so the analytics screen and the register it summarises cannot drift.
 */
final class AnalyticsController
{
    public function __construct(
        private readonly Database $db,
        private readonly DashboardRepository $dashboard,
        private readonly DashboardPresenter $presenter,
        private readonly Clock $clock,
    ) {
    }

    /** #167 GET /admin/analytics/overview */
    public function overview(Request $request): Response
    {
        $days = min(400, max(1, $request->queryInt('days', 90)));

        return Response::data([
            'registers' => [
                'orders' => $this->tally('SELECT console_state AS k, COUNT(*) AS n FROM orders GROUP BY console_state'),
                'payments' => $this->tally('SELECT status AS k, COUNT(*) AS n FROM payments GROUP BY status'),
                'shipments' => $this->tally('SELECT status AS k, COUNT(*) AS n FROM shipments GROUP BY status'),
            ],
            'period' => [
                'series' => $this->presenter->trading($this->dashboard->trading($days)),
            ],
        ]);
    }

    /** #168 GET /admin/analytics/breakdowns */
    public function breakdowns(Request $request): Response
    {
        return Response::data([
            'order_status' => $this->tally('SELECT status AS k, COUNT(*) AS n FROM orders GROUP BY status'),
            'payment_state' => $this->tally('SELECT status AS k, COUNT(*) AS n FROM payments GROUP BY status'),
            'sellable_by_item' => $this->db->select(
                'SELECT s.public_id AS item, s.item_name AS name, (s.total_units - s.reserved_units) AS sellable
                   FROM stock_items s WHERE s.deleted_at IS NULL ORDER BY sellable DESC',
            ),
            'units_by_warehouse' => $this->db->select(
                'SELECT w.public_id AS warehouse, COALESCE(SUM(s.total_units), 0) AS units
                   FROM warehouses w LEFT JOIN stock_items s ON s.warehouse_id = w.id AND s.deleted_at IS NULL
                  GROUP BY w.id, w.public_id ORDER BY w.public_id',
            ),
            'returns_by_reason' => $this->tally('SELECT reason AS k, COUNT(*) AS n FROM return_requests GROUP BY reason'),
            'returns_by_outcome' => $this->tally('SELECT outcome AS k, COUNT(*) AS n FROM return_requests GROUP BY outcome'),
        ]);
    }

    /**
     * #169 POST /admin/analytics/export — queued, not computed inline.
     * A report that blocks the request for a minute is a report nobody runs.
     */
    public function export(Request $request): Response
    {
        /** @var array{window?: string} $input */
        $input = $request->validated();
        $window = (string) ($input['window'] ?? '30d');

        $jobId = $this->db->insert(
            'INSERT INTO job_queue (queue, type, payload_json, run_after, created_at) VALUES (?, ?, ?, ?, ?)',
            [
                'documents',
                'analytics.export',
                Json::encode(['window' => $window, 'requested_at' => $this->clock->nowString()]),
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );

        return Response::data(['job_id' => (string) $jobId, 'window' => $window], 202);
    }

    /**
     * @return array<string, int>
     */
    private function tally(string $sql): array
    {
        $tally = [];

        foreach ($this->db->select($sql) as $row) {
            $tally[(string) $row['k']] = (int) $row['n'];
        }

        return $tally;
    }
}
