<?php

declare(strict_types=1);

namespace Iced\Service\Order;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Repository\OrderRepository;
use Iced\Repository\ShipmentRepository;
use Iced\Service\Inventory\StockService;
use Iced\Service\Settings\StoreSettings;
use Iced\Service\Shipping\ShipmentService;
use Iced\Support\Clock;
use Iced\Support\IdAllocator;

/**
 * The console half of the order state machine (spec §9.3).
 *
 *   Placed → Confirmed → (dispatch → deliver) · Cancelled
 *
 * Three guards, all enforced here rather than in the UI:
 *   · confirm is refused while the payment is Failed,
 *   · dispatch is refused while a live shipment already exists,
 *   · cancel releases reservations and cancels open shipments atomically.
 */
final class OrderConsoleService
{
    public function __construct(
        private readonly Database $db,
        private readonly OrderRepository $orders,
        private readonly ShipmentRepository $shipments,
        private readonly StockService $stock,
        private readonly ShipmentService $shipping,
        private readonly StoreSettings $settings,
        private readonly IdAllocator $ids,
        private readonly Clock $clock,
    ) {
    }

    /** @return array<string, mixed> */
    public function find(string $number): array
    {
        $order = $this->orders->findByNumber($number);

        if ($order === null) {
            throw new NotFoundException('ICE-ORD-404', 'We could not find that order.');
        }

        return $order;
    }

    /** #96 confirm — 409 when the payment failed. */
    public function confirm(string $number, Principal $actor): array
    {
        return $this->db->transaction(function () use ($number, $actor): array {
            $order = $this->find($number);
            $orderId = (int) $order['id'];

            if ((string) $order['console_state'] === 'Cancelled') {
                throw new ConflictException('ICE-ORD-409', 'That order was cancelled and cannot be confirmed.');
            }

            if ((string) $order['console_state'] === 'Confirmed') {
                return $this->find($number);
            }

            $payment = $this->orders->latestPayment($orderId);

            if ($payment !== null && (string) $payment['status'] === 'Failed') {
                throw new ConflictException(
                    'ICE-ORD-409',
                    'That payment failed, so the order cannot be confirmed yet.',
                );
            }

            $this->orders->updateState($orderId, 'Confirmed', (string) $order['status'], null, (int) $order['version']);
            $this->orders->appendHistory($orderId, 'Placed', 'Confirmed', 'staff', $actor->userId, 'Confirmed in the console');

            return $this->find($number);
        });
    }

    /** #97 cancel — cancels open shipments and releases held stock in the same transaction. */
    public function cancel(string $number, string $by, Principal $actor): array
    {
        if (!in_array($by, ['Store', 'Customer'], true)) {
            throw ValidationException::field('by', 'Say whether the store or the customer called it off.', 'ICE-ORD-422');
        }

        return $this->db->transaction(function () use ($number, $by, $actor): array {
            $order = $this->find($number);
            $orderId = (int) $order['id'];

            if ((string) $order['console_state'] === 'Cancelled') {
                return $this->find($number);
            }

            foreach ($this->orders->openShipments($orderId) as $shipment) {
                $this->shipments->setStatus((int) $shipment['id'], 'Cancelled', null, null);
                $this->shipments->appendEvent(
                    (int) $shipment['id'],
                    'Cancelled',
                    'The order was called off.',
                    true,
                );
            }

            $this->stock->releaseReservationsForOrder($orderId, $actor->userId);

            $this->orders->updateState($orderId, 'Cancelled', 'Cancelled', $by, (int) $order['version']);
            $this->orders->appendHistory(
                $orderId,
                (string) $order['console_state'],
                'Cancelled',
                'staff',
                $actor->userId,
                sprintf('Cancelled by %s', strtolower($by)),
            );

            return $this->find($number);
        });
    }

    /** #98 dispatch — 409 when a live shipment already exists. */
    public function dispatch(string $number, string $provider, ?string $destination, Principal $actor): array
    {
        return $this->db->transaction(function () use ($number, $provider, $destination, $actor): array {
            $order = $this->find($number);
            $orderId = (int) $order['id'];

            if ((string) $order['console_state'] !== 'Confirmed') {
                throw new ConflictException('ICE-ORD-409', 'Confirm the order before dispatching it.');
            }

            if ($this->orders->hasLiveShipment($orderId)) {
                throw new ConflictException('ICE-ORD-409', 'That order already has a parcel on its way.');
            }

            // Courier names are a settings vocabulary, so the check belongs here
            // rather than in a route file that can never see the table.
            $providers = $this->shipping->providers();

            if (!in_array($provider, $providers, true)) {
                throw ValidationException::field(
                    'provider',
                    sprintf('Choose one of: %s.', implode(', ', $providers)),
                    'ICE-SHIP-422',
                );
            }

            $shipmentId = $this->shipments->nextPublicId();
            $token = $this->ids->allocate('tracking');

            // The promise window is the delivery policy, read live.
            [$fromDays, $toDays] = $this->settings->map('delivery.standard_window', [3, 5]);

            $id = $this->shipments->create([
                'public_id' => $shipmentId,
                'order_id' => $orderId,
                'order_number' => (string) $order['number'],
                'provider' => $provider,
                'awb' => sprintf('IOL%s', substr((string) preg_replace('/\D/', '', $shipmentId . $token), 0, 8)),
                'destination' => $destination ?? sprintf('%s %s', $order['addr_city'], $order['addr_postal']),
                'dispatched_label' => \Iced\Presenter\Format::shortDate($this->clock->now()),
                'promise_label' => \Iced\Presenter\Format::tightWindow(
                    $this->clock->addSeconds((int) $fromDays * 86400),
                    $this->clock->addSeconds((int) $toDays * 86400),
                ),
                'status' => 'Dispatched',
                'tracking_token' => $token,
            ]);

            $this->shipments->appendEvent($id, 'Dispatched', sprintf('Handed to %s.', $provider), true);
            $this->orders->appendHistory($orderId, 'Confirmed', 'Dispatched', 'staff', $actor->userId, sprintf('Dispatched via %s', $provider));

            // Reserved stock becomes sold the moment the parcel leaves.
            $this->stock->confirmReservationsForOrder($orderId, $actor->userId);

            return $this->shipments->findByPublicId($shipmentId) ?? [];
        });
    }
}
