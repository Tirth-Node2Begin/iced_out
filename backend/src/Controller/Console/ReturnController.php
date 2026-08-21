<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\ReturnPresenter;
use Iced\Repository\ReturnRepository;
use Iced\Service\Returns\ReturnService;

/** Spec §8.23 — console returns (8 endpoints). */
final class ReturnController
{
    public function __construct(
        private readonly ReturnRepository $returns,
        private readonly ReturnService $service,
        private readonly ReturnPresenter $presenter,
    ) {
    }

    /** #132 GET /admin/returns?tab=requests|exchanges */
    public function index(Request $request): Response
    {
        return Response::data($this->presenter->adminRows($this->returns->search([
            'tab' => $request->queryString('tab'),
            'state' => $request->queryString('state'),
            'q' => $request->queryString('q'),
        ])));
    }

    /** #133 GET /admin/returns/{id} — the row plus its live exchange balance. */
    public function show(Request $request): Response
    {
        $return = $this->service->find($request->routeParam('id'));

        return Response::data(
            $this->presenter->adminRow($return) + ['balance' => $this->presenter->balance($return)],
        );
    }

    /** #134 POST /admin/returns/{id}/approve */
    public function approve(Request $request): Response
    {
        return $this->act($request, fn (string $id, Principal $actor): array => $this->service->approve($id, $actor));
    }

    /** #135 POST /admin/returns/{id}/reject */
    public function reject(Request $request): Response
    {
        return $this->act($request, fn (string $id, Principal $actor): array => $this->service->reject($id, $actor));
    }

    /** #136 POST /admin/returns/{id}/collect-payment */
    public function collectPayment(Request $request): Response
    {
        return $this->act($request, fn (string $id, Principal $actor): array => $this->service->collectPayment($id, $actor));
    }

    /** #137 POST /admin/returns/{id}/settle */
    public function settle(Request $request): Response
    {
        return $this->act($request, fn (string $id, Principal $actor): array => $this->service->settle($id, $actor));
    }

    /** #138 GET /admin/returns/{id}/history */
    public function history(Request $request): Response
    {
        $return = $this->service->find($request->routeParam('id'));

        return Response::data($this->presenter->history($this->returns->history((int) $return['id'])));
    }

    /** @param callable(string, Principal): array<string, mixed> $work */
    private function act(Request $request, callable $work): Response
    {
        $id = $request->routeParam('id');
        $actor = $this->actor($request);

        $request->setAttribute('audit_entity_type', 'return');
        $request->setAttribute('audit_entity_id', $id);
        $request->setAttribute('audit_before', $this->presenter->adminRow($this->service->find($id)));

        $row = $this->presenter->adminRow($work($id, $actor));
        $request->setAttribute('audit_after', $row);

        return Response::data($row);
    }

    private function actor(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException();
        }

        return $principal;
    }
}
