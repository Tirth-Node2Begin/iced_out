<?php

declare(strict_types=1);

namespace Iced\Service\Order;

use Iced\Domain\Money;
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
use Iced\Service\Wallet\WalletService;
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
        private readonly WalletService $wallet,
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

            /* ---- YOU CANNOT CALL OFF SOMETHING ALREADY IN THEIR HANDS -------

               Cancellation had no state guard at all. `console_state` only ever
               holds Placed, Confirmed or Cancelled — delivery is recorded on the
               SHIPMENT and mirrored into `orders.status` — so an order that had
               been delivered still read as `Confirmed` here and cancelled
               happily.

               That was free money in the wrong direction, and it got worse the
               moment the wallet reversal below started working: cancelling a
               delivered order now returns the store credit for goods the
               customer already has. `openShipments()` even excludes Delivered
               shipments, so the one signal that something was wrong was
               deliberately filtered out two lines further down.

               A delivered order that needs unwinding goes through returns and
               refunds, which is where the goods coming back is part of the
               transaction. Cancellation is for an order that has not gone
               anywhere yet, and this is the line that says so.

               `orders.status` rather than the shipment rows, because it is the
               field the check constraint governs and the one the console shows —
               a guard that reads a different column from the one staff are
               looking at is a guard people argue with. */
            if ((string) $order['status'] === 'Delivered') {
                throw new ConflictException(
                    'ICE-ORD-409',
                    'That order has already been delivered. Raise a return instead of cancelling it.',
                );
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

            /* ---- give the store credit back ---------------------------------

               `WalletService::reverseOrder()` was written for exactly this and
               was called from nowhere. The consequence was quiet and entirely
               one-sided: an order part-paid from the wallet released its stock
               when cancelled and kept the money. A shopper who spent ₹2,000 of
               credit on an order the store then called off lost ₹2,000, with a
               ledger that showed the debit and no matching return.

               Inside the same transaction as everything else here, so a
               cancellation that fails to write cannot credit a wallet for an
               order that is still live.

               `KIND_REVERSAL` rather than a credit of kind `order`: the debit
               already holds that (kind, reference) pair, and the unique index on
               it is what makes this idempotent — cancelling twice credits once,
               which matters because the console's cancel button is retryable and
               the first thing anyone does with a slow request is press it again.

               A guest order has no account to credit. The voucher path is how
               those are settled, and inventing a wallet for a null user_id would
               put the money somewhere nobody can spend it. */
            $walletApplied = Money::fromDecimalString((string) ($order['wallet_applied'] ?? '0.00'));

            if ($walletApplied->paise > 0 && $order['user_id'] !== null) {
                $this->wallet->reverseOrder(
                    (int) $order['user_id'],
                    $walletApplied,
                    (string) $order['number'],
                    sprintf('Returned when %s was cancelled.', (string) $order['number']),
                );
            }

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
