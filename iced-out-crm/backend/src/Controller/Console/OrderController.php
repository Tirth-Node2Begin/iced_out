<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\OrderPresenter;
use Iced\Presenter\ShipmentPresenter;
use Iced\Repository\OrderRepository;
use Iced\Service\Order\OrderConsoleService;
use Iced\Support\Paginator;

/** Spec §8.19 — console orders (6 endpoints). */
final class OrderController
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderConsoleService $service,
        private readonly OrderPresenter $presenter,
        private readonly ShipmentPresenter $shipments,
    ) {
    }

    /** #94 GET /admin/orders */
    public function index(Request $request): Response
    {
        $page = Paginator::fromRequest($request);

        $result = $this->orders->search([
            'status' => $request->queryString('status'),
            'payment' => $request->queryString('payment'),
            'q' => $request->queryString('q'),
        ], $page);

        return Response::paginated($this->presenter->rows($result['rows']), $page->meta($result['total']));
    }

    /** #95 GET /admin/orders/{number} */
    public function show(Request $request): Response
    {
        $order = $this->service->find($request->routeParam('number'));
        $orderId = (int) $order['id'];

        return Response::data([
            'row' => $this->presenter->row($order),
            'lines' => $this->presenter->lines($this->orders->lines($orderId)),
            'timeline' => $this->presenter->timeline($this->orders->timeline($orderId)),
        ]);
    }

    /** #96 POST /admin/orders/{number}/confirm */
    public function confirm(Request $request): Response
    {
        $number = $request->routeParam('number');
        $request->setAttribute('audit_entity_type', 'order');
        $request->setAttribute('audit_entity_id', $number);
        $request->setAttribute('audit_before', $this->presenter->row($this->service->find($number)));

        $row = $this->presenter->row($this->service->confirm($number, $this->actor($request)));
        $request->setAttribute('audit_after', $row);

        return Response::data($row);
    }

    /** #97 POST /admin/orders/{number}/cancel */
    public function cancel(Request $request): Response
    {
        $number = $request->routeParam('number');
        /** @var array{by: string} $input */
        $input = $request->validated();

        $request->setAttribute('audit_entity_type', 'order');
        $request->setAttribute('audit_entity_id', $number);
        $request->setAttribute('audit_before', $this->presenter->row($this->service->find($number)));

        $row = $this->presenter->row($this->service->cancel($number, $input['by'], $this->actor($request)));
        $request->setAttribute('audit_after', $row);

        return Response::data($row);
    }

    /** #98 POST /admin/orders/{number}/dispatch */
    public function dispatch(Request $request): Response
    {
        $number = $request->routeParam('number');
        /** @var array{provider: string, destination?: string} $input */
        $input = $request->validated();

        $shipment = $this->service->dispatch(
            $number,
            $input['provider'],
            $input['destination'] ?? null,
            $this->actor($request),
        );

        $request->setAttribute('audit_entity_type', 'order');
        $request->setAttribute('audit_entity_id', $number);
        $request->setAttribute('audit_after', $shipment === [] ? null : $this->shipments->row($shipment));

        return Response::data($this->shipments->row($shipment), 201);
    }

    /** #99 GET /admin/orders/{number}/timeline */
    public function timeline(Request $request): Response
    {
        $order = $this->service->find($request->routeParam('number'));

        return Response::data($this->presenter->timeline($this->orders->timeline((int) $order['id'])));
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
