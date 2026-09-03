<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Integration\Tracking\PlaceholderTrackingProvider;
use Iced\Integration\Tracking\TrackingProvider;
use Iced\Integration\Tracking\TrackingSnapshot;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\ShipmentPresenter;
use Iced\Repository\ShipmentRepository;
use Iced\Service\Shipping\ShipmentService;

/** Spec §8.20 — console shipments, pickups and NDR (10 endpoints). */
final class ShipmentController
{
    /**
     * Where the cached courier tail starts.
     *
     * High enough that no internal milestone can reach it — a shipment
     * accumulates a handful, not a thousand — so the courier's scans always
     * sort after the console's own without the two having to be renumbered
     * against each other on every refresh.
     */
    private const EXTERNAL_POSITION_BASE = 1000;

    public function __construct(
        private readonly ShipmentRepository $shipments,
        private readonly ShipmentService $service,
        private readonly ShipmentPresenter $presenter,
        private readonly TrackingProvider $tracking,
        private readonly Database $db,
    ) {
    }

    /** #100 GET /admin/shipments?tab=active|failed|all */
    public function index(Request $request): Response
    {
        $rows = $this->shipments->search([
            'tab' => $request->queryString('tab', 'all'),
            'q' => $request->queryString('q'),
        ]);

        return Response::data($this->presenter->rows($rows));
    }

    /** #101 GET /admin/shipments/{id} */
    public function show(Request $request): Response
    {
        $shipment = $this->service->find($request->routeParam('id'));

        return Response::data(
            $this->presenter->row($shipment) + [
                'events' => $this->presenter->events($this->shipments->events((int) $shipment['id'])),
            ],
        );
    }

    /** #102 POST /admin/shipments/{id}/transition */
    public function transition(Request $request): Response
    {
        /** @var array{status: string, reason?: string} $input */
        $input = $request->validated();
        $id = $request->routeParam('id');

        $request->setAttribute('audit_entity_type', 'shipment');
        $request->setAttribute('audit_entity_id', $id);

        $row = $this->presenter->row($this->service->transition(
            $id,
            $input['status'],
            $input['reason'] ?? null,
            $this->actor($request),
        ));

        $request->setAttribute('audit_after', $row);

        return Response::data($row);
    }

    /** #103 POST /admin/shipments/{id}/resend */
    public function resend(Request $request): Response
    {
        $id = $request->routeParam('id');
        $request->setAttribute('audit_entity_type', 'shipment');
        $request->setAttribute('audit_entity_id', $id);

        return Response::data($this->presenter->row($this->service->resend($id, $this->actor($request))));
    }

    /** #104 POST /admin/shipments/{id}/return-to-store */
    public function returnToStore(Request $request): Response
    {
        $id = $request->routeParam('id');
        $request->setAttribute('audit_entity_type', 'shipment');
        $request->setAttribute('audit_entity_id', $id);

        return Response::data($this->presenter->row($this->service->returnToStore($id)));
    }

    /** #105 POST /admin/shipments/{id}/arrived-back */
    public function arrivedBack(Request $request): Response
    {
        $id = $request->routeParam('id');
        $request->setAttribute('audit_entity_type', 'shipment');
        $request->setAttribute('audit_entity_id', $id);

        return Response::data($this->presenter->row($this->service->arrivedBack($id, $this->actor($request))));
    }

    /** #106 POST /admin/shipments/{id}/label — a 4×6 reprint. */
    public function label(Request $request): Response
    {
        $shipment = $this->service->find($request->routeParam('id'));

        return Response::data([
            'url' => sprintf('/api/v1/admin/shipments/%s/label.pdf', $shipment['public_id']),
            'awb' => (string) $shipment['awb'],
        ]);
    }

    /**
     * #107 POST /admin/shipments/{id}/refresh — asks iThink Logistics what the
     * courier knows, and caches the answer (spec §9.8).
     *
     * The scan tail is REPLACED, not appended to: a courier re-states its whole
     * history on every call, and a courier may also correct one (a scan
     * withdrawn, a location fixed). Merging would leave the retracted scan on
     * screen forever, so the external rows are dropped and rewritten inside one
     * transaction while the internal milestones — dispatched, delivered, the
     * console's own state machine — are never touched.
     *
     * `courier_status` is reported ALONGSIDE the shipment's own status rather
     * than written over it. Delivery here closes the order, makes a COD payment
     * collectible and marks the items return-eligible; those are things a person
     * takes responsibility for, so this screen shows staff what the courier says
     * and leaves the transition to the button that has an actor behind it.
     *
     * With the placeholder bound — no credentials on this server — nothing is
     * cached and `note` says so, rather than a refresh appearing to succeed.
     */
    public function refresh(Request $request): Response
    {
        $shipment = $this->service->find($request->routeParam('id'));

        $snapshot = $this->tracking->fetch((string) $shipment['awb'], (string) $shipment['provider']);

        if ($snapshot->fromProvider) {
            $this->cacheScans((int) $shipment['id'], $snapshot);
        }

        return Response::data(
            $this->presenter->row($shipment) + [
                'refreshed' => $snapshot->fromProvider,
                'courier_status' => $snapshot->status ?? '',
                'courier_estimate' => $snapshot->estimate ?? '',
                'scans' => count($snapshot->events),
                'note' => $snapshot->fromProvider
                    ? ''
                    : ($snapshot->note !== '' ? $snapshot->note : PlaceholderTrackingProvider::NOTE),
            ],
        );
    }

    /**
     * Swaps the cached courier tail for the one just fetched.
     *
     * In a transaction because the delete and the writes are one act: a failure
     * halfway would leave the shipment with part of a history, which reads as a
     * parcel that has lost its scans rather than as a call that did not finish.
     */
    private function cacheScans(int $shipmentId, TrackingSnapshot $snapshot): void
    {
        $this->db->transaction(function () use ($shipmentId, $snapshot): void {
            $this->shipments->replaceExternalEvents($shipmentId);

            foreach (array_values($snapshot->events) as $position => $event) {
                $this->shipments->appendExternalEvent(
                    $shipmentId,
                    $event['label'],
                    $event['detail'],
                    $event['time'],
                    $event['complete'],
                    /* Offset past the internal milestones so the courier tail
                       sorts after them; `events()` orders by position then id. */
                    self::EXTERNAL_POSITION_BASE + $position,
                    $event['time'] === '' ? null : $event['label'] . '@' . $event['time'],
                );
            }
        });
    }

    /** #108 GET /admin/pickups */
    public function pickups(Request $request): Response
    {
        return Response::data($this->presenter->pickups($this->shipments->pickups()));
    }

    /** #108 POST /admin/pickups */
    public function createPickup(Request $request): Response
    {
        /** @var array{provider: string, parcels: int, pickup: string} $input */
        $input = $request->validated();

        $publicId = $this->shipments->nextPickupId();
        $this->shipments->createPickup($publicId, $input['provider'], $input['parcels'], $input['pickup']);

        $row = $this->shipments->findPickup($publicId);
        $request->setAttribute('audit_entity_type', 'pickup');
        $request->setAttribute('audit_entity_id', $publicId);

        return Response::data($row === null ? [] : $this->presenter->pickup($row), 201);
    }

    /** #109 POST /admin/pickups/{id}/handover */
    public function handover(Request $request): Response
    {
        $id = $request->routeParam('id');

        if ($this->shipments->findPickup($id) === null) {
            throw new NotFoundException('ICE-SHIP-404', 'We could not find that pickup.');
        }

        $this->shipments->handOverPickup($id);
        $row = $this->shipments->findPickup($id);

        $request->setAttribute('audit_entity_type', 'pickup');
        $request->setAttribute('audit_entity_id', $id);

        return Response::data($row === null ? [] : $this->presenter->pickup($row));
    }

    /** The NDR board — /admin/shipments/ndr. */
    public function ndr(Request $request): Response
    {
        return Response::data($this->presenter->ndrCases($this->shipments->ndrCases()));
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
