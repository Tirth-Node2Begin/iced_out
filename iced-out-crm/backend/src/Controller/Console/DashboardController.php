<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\DashboardPresenter;
use Iced\Repository\DashboardRepository;

/** Spec §8.18 — console dashboard (5 endpoints), permission `dashboard.view`. */
final class DashboardController
{
    public function __construct(
        private readonly DashboardRepository $repository,
        private readonly DashboardPresenter $presenter,
    ) {
    }

    /** #89 GET /admin/dashboard/queues — the six named work queues. */
    public function queues(Request $request): Response
    {
        return Response::data($this->presenter->queues($this->repository->queues()));
    }

    /** #90 GET /admin/dashboard/trading?days=200 */
    public function trading(Request $request): Response
    {
        $days = min(400, max(1, $request->queryInt('days', 200)));

        return Response::data(['series' => $this->presenter->trading($this->repository->trading($days))]);
    }

    /** #91 GET /admin/dashboard/activity?after=&limit=8 — polled, replaces the simulator. */
    public function activity(Request $request): Response
    {
        $after = max(0, $request->queryInt('after', 0));
        $limit = min(100, max(1, $request->queryInt('limit', 8)));

        return Response::data(['entries' => $this->presenter->activity($this->repository->activity($after, $limit))]);
    }

    /** #92 GET /admin/dashboard/pulse?limit=40 — the bell drawer. */
    public function pulse(Request $request): Response
    {
        $limit = min(40, max(1, $request->queryInt('limit', 40)));

        return Response::data(['signals' => $this->presenter->signals($this->repository->signals($limit))]);
    }

    /** #93 GET /admin/dashboard/summary — the headline KPIs. */
    public function summary(Request $request): Response
    {
        return Response::data($this->presenter->summary($this->repository->summaryToday()));
    }
}
