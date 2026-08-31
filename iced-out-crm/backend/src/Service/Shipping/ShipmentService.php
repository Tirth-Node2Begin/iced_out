<?php

declare(strict_types=1);

namespace Iced\Service\Shipping;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Repository\OrderRepository;
use Iced\Repository\ShipmentRepository;
use Iced\Service\Inventory\StockService;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

/**
 * The shipment machine of spec §9.4:
 *
 *   Dispatched → In transit | Cancelled
 *   In transit → Delivered  | Failed
 *   Failed     → In transit (resend, NDR attempt ≤ 3)
 *              → handling "Sending back" (RTO) → Cancelled + "Back in store"
 *
 * Illegal moves are refused with 409 rather than quietly accepted, and a
 * `Failed` move must name a reason from the fixed vocabulary — an operator who
 * cannot say why it failed has not learnt anything the NDR case can act on.
 */
final class ShipmentService
{
    /** @var array<string, list<string>> */
    private const LEGAL = [
        'Dispatched' => ['In transit', 'Cancelled'],
        'In transit' => ['Delivered', 'Failed'],
        'Failed' => ['In transit', 'Cancelled'],
        'Delivered' => [],
        'Cancelled' => [],
    ];

    /** Used only when the settings table has been wiped. */
    private const FALLBACK_FAIL_REASONS = [
        'Nobody was home',
        'Address was wrong',
        'Customer said no',
        'Could not reach the customer',
        'Not shared yet',
    ];

    public function __construct(
        private readonly Database $db,
        private readonly ShipmentRepository $shipments,
        private readonly OrderRepository $orders,
        private readonly StockService $stock,
        private readonly StoreSettings $settings,
        private readonly Clock $clock,
    ) {
    }

    /**
     * The vocabulary a failed delivery must name a reason from — settings, not
     * a constant, because "why did it fail" is a list operations owns.
     *
     * @return list<string>
     */
    public function failReasons(): array
    {
        return $this->settings->vocabulary('shipping.fail_reasons', self::FALLBACK_FAIL_REASONS);
    }

    /** @return list<string> */
    public function providers(): array
    {
        return $this->settings->vocabulary('shipping.providers', ['Blue Dart', 'Delhivery', 'Ecom Express']);
    }

    /** @return array<string, mixed> */
    public function find(string $publicId): array
    {
        $shipment = $this->shipments->findByPublicId($publicId);

        if ($shipment === null) {
            throw new NotFoundException('ICE-SHIP-404', 'We could not find that shipment.');
        }

        return $shipment;
    }

    /** #102 transition */
    public function transition(string $publicId, string $status, ?string $reason, Principal $actor): array
    {
        return $this->db->transaction(function () use ($publicId, $status, $reason, $actor): array {
            $shipment = $this->find($publicId);
            $current = (string) $shipment['status'];

            if ($current === $status) {
                return $shipment;
            }

            if (!in_array($status, self::LEGAL[$current] ?? [], true)) {
                throw new ConflictException(
                    'ICE-SHIP-409',
                    sprintf('A parcel that is %s cannot become %s.', strtolower($current), strtolower($status)),
                );
            }

            if ($status === 'Failed' && ($reason === null || !in_array($reason, $this->failReasons(), true))) {
                throw ValidationException::field(
                    'reason',
                    'Choose why the delivery failed.',
                    'ICE-SHIP-422',
                );
            }

            $shipmentId = (int) $shipment['id'];

            match ($status) {
                'Failed' => $this->fail($shipmentId, (string) $reason),
                'Delivered' => $this->deliver($shipmentId, $shipment, $actor),
                'Cancelled' => $this->cancel($shipmentId, $shipment),
                default => $this->advance($shipmentId, $status),
            };

            return $this->find($publicId);
        });
    }

    /** #103 resend — a failed parcel goes back out, NDR attempt +1, max 3. */
    public function resend(string $publicId, Principal $actor): array
    {
        return $this->db->transaction(function () use ($publicId): array {
            $shipment = $this->find($publicId);

            if ((string) $shipment['status'] !== 'Failed') {
                throw new ConflictException('ICE-SHIP-409', 'Only a failed parcel can be sent out again.');
            }

            $shipmentId = (int) $shipment['id'];
            $maxAttempts = $this->settings->int('shipping.max_delivery_attempts', 3);
            $attempts = $this->shipments->bumpNdrAttempt($shipmentId, (string) ($shipment['fail_reason'] ?? ''));

            if ($attempts > $maxAttempts) {
                throw new ConflictException(
                    'ICE-SHIP-409',
                    sprintf(
                        'This parcel has already been attempted %d times — send it back to the store instead.',
                        $maxAttempts,
                    ),
                );
            }

            $this->shipments->setStatus($shipmentId, 'In transit', null, null);
            $this->shipments->appendEvent($shipmentId, 'Out again', sprintf('Attempt %d of %d.', $attempts, $maxAttempts), true);

            return $this->find($publicId);
        });
    }

    /** #104 return-to-store — RTO initiated. */
    public function returnToStore(string $publicId): array
    {
        return $this->db->transaction(function () use ($publicId): array {
            $shipment = $this->find($publicId);
            $shipmentId = (int) $shipment['id'];

            $this->shipments->setHandling($shipmentId, 'Sending back');
            $this->shipments->closeNdr($shipmentId, 'RTO');
            $this->shipments->appendEvent($shipmentId, 'Returning to store', 'On its way back to the warehouse.', true);

            return $this->find($publicId);
        });
    }

    /** #105 arrived-back — the goods are physically in again, so stock moves. */
    public function arrivedBack(string $publicId, Principal $actor): array
    {
        return $this->db->transaction(function () use ($publicId, $actor): array {
            $shipment = $this->find($publicId);
            $shipmentId = (int) $shipment['id'];
            $orderId = (int) $shipment['order_id'];

            $this->shipments->setStatus($shipmentId, 'Cancelled', (string) ($shipment['fail_reason'] ?? ''), 'Back in store');
            $this->shipments->closeNdr($shipmentId, 'Closed');
            $this->shipments->appendEvent($shipmentId, 'Back in store', 'Received at the warehouse.', true);

            foreach ($this->orders->lines($orderId) as $line) {
                $variant = $this->db->selectOne(
                    'SELECT id FROM product_variants WHERE product_id = ? AND size = ? AND deleted_at IS NULL LIMIT 1',
                    [$line['product_id'], $line['size']],
                );

                if ($variant !== null) {
                    $this->stock->receiveBack(
                        (int) $variant['id'],
                        (int) $line['quantity'],
                        'RTO_IN',
                        'shipment',
                        $publicId,
                        $actor->userId,
                    );
                }
            }

            return $this->find($publicId);
        });
    }

    private function advance(int $shipmentId, string $status): void
    {
        $this->shipments->setStatus($shipmentId, $status, null, null);
        $this->shipments->appendEvent($shipmentId, $status, '', true);
    }

    private function fail(int $shipmentId, string $reason): void
    {
        $this->shipments->setStatus($shipmentId, 'Failed', $reason, 'Needs action');
        $this->shipments->bumpNdrAttempt($shipmentId, $reason);
        $this->shipments->appendEvent($shipmentId, 'Delivery attempted', $reason, true);
    }

    /** Delivery closes the order and makes a COD payment collectible. */
    private function deliver(int $shipmentId, array $shipment, Principal $actor): void
    {
        $this->shipments->setStatus($shipmentId, 'Delivered', null, null);
        $this->shipments->closeNdr($shipmentId, 'Closed');
        $this->shipments->appendEvent($shipmentId, 'Delivered', 'Signed for at the door.', true);

        $orderId = (int) $shipment['order_id'];
        $order = $this->db->selectOne('SELECT * FROM orders WHERE id = ?', [$orderId]);

        if ($order === null) {
            return;
        }

        $this->orders->updateState($orderId, (string) $order['console_state'], 'Delivered', null, (int) $order['version']);
        $this->orders->appendHistory($orderId, (string) $order['status'], 'Delivered', 'staff', $actor->userId, 'Parcel delivered');

        $this->db->statement(
            "UPDATE order_items SET return_eligible = 1 WHERE order_id = ?",
            [$orderId],
        );

        // COD stays Due until someone says the cash came back; delivery is what
        // makes that collection legitimate (`collect-cod`, endpoint #145).
        $this->db->statement(
            "UPDATE payments SET note = 'Collect on delivery', updated_at = ?
              WHERE order_id = ? AND status = 'Due'",
            [$this->clock->nowString(), $orderId],
        );
    }

    private function cancel(int $shipmentId, array $shipment): void
    {
        $this->shipments->setStatus($shipmentId, 'Cancelled', $shipment['fail_reason'] === null ? null : (string) $shipment['fail_reason'], null);
        $this->shipments->appendEvent($shipmentId, 'Cancelled', 'The parcel was called back.', true);
    }
}
