<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CustomerOrderPresenter;
use Iced\Presenter\Format;
use Iced\Repository\OrderRepository;
use Iced\Service\Checkout\PlaceOrderService;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

/** Spec §8.9 — checkout. The place-order call is the one that matters. */
final class CheckoutController
{
    public function __construct(
        private readonly PlaceOrderService $placeOrder,
        private readonly OrderRepository $orders,
        private readonly CustomerOrderPresenter $presenter,
        private readonly StoreSettings $settings,
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * #52 POST /checkout/orders  [idem]
     *
     * The whole transaction of spec §9.2 — validate, reserve, price, allocate,
     * write. Idempotent, because a shopper who double-taps CHECKOUT on a slow
     * connection must not buy the same bag twice.
     */
    public function place(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array<string, mixed> $body */
        $body = $request->body();

        $order = $this->placeOrder->place($principal, $body);
        $orderId = (int) $order['id'];

        $request->setAttribute('audit_entity_type', 'order');
        $request->setAttribute('audit_entity_id', (string) $order['number']);

        return Response::data($this->presenter->record(
            $order,
            $this->orders->lines($orderId),
            $this->orders->latestPayment($orderId),
            null,
        ), 201);
    }

    /**
     * #51 GET /checkout/delivery-options — the fees and windows the summary
     * quotes, priced against this bag rather than assumed.
     */
    public function deliveryOptions(Request $request): Response
    {
        $subtotal = Money::fromRupees(max(0, $request->queryInt('subtotal', 0)));
        $freeOver = Money::fromRupees($this->settings->int('delivery.free_over', 4999));

        /** @var array{0: int, 1: int} $standardWindow */
        $standardWindow = $this->settings->map('delivery.standard_window', [3, 5]);
        /** @var array{0: int, 1: int} $expressWindow */
        $expressWindow = $this->settings->map('delivery.express_window', [1, 2]);

        return Response::data([
            [
                'id' => 'standard',
                'label' => 'Standard delivery',
                // Free over the threshold, measured before any discount (§9.1).
                'fee' => $freeOver->isGreaterThan($subtotal) ? $this->settings->int('delivery.standard_fee', 199) : 0,
                'estimate' => $this->window((int) $standardWindow[0], (int) $standardWindow[1]),
            ],
            [
                'id' => 'express',
                'label' => 'Express delivery',
                'fee' => $this->settings->int('delivery.express_fee', 499),
                'estimate' => $this->window((int) $expressWindow[0], (int) $expressWindow[1]),
            ],
        ]);
    }

    /** #49 GET /me/checkout/draft */
    public function draft(Request $request): Response
    {
        $principal = $this->principal($request);
        $row = $this->db->selectOne('SELECT * FROM checkout_drafts WHERE user_id = ?', [$principal->userId]);

        return Response::data([
            'name' => (string) ($row['name'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'mobile' => (string) ($row['mobile'] ?? ''),
            'address' => (string) ($row['address'] ?? ''),
            'city' => (string) ($row['city'] ?? ''),
            'state' => (string) ($row['state'] ?? ''),
            'postalCode' => (string) ($row['postal_code'] ?? ''),
            // An unknown stored enum resets to the default rather than being
            // handed to a form that has no such option (spec §8.9 #49).
            'deliveryMethod' => in_array((string) ($row['delivery_method'] ?? ''), ['standard', 'express'], true)
                ? (string) $row['delivery_method']
                : 'standard',
            'paymentMethod' => in_array((string) ($row['payment_method'] ?? ''), ['cod', 'card', 'razorpay'], true)
                ? (string) $row['payment_method']
                : 'cod',
        ]);
    }

    /** #50 PUT /me/checkout/draft — saved on every step, so a reload resumes. */
    public function saveDraft(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $this->db->statement(
            'INSERT INTO checkout_drafts
                (user_id, name, email, mobile, address, city, state, postal_code, delivery_method, payment_method)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                name = VALUES(name), email = VALUES(email), mobile = VALUES(mobile), address = VALUES(address),
                city = VALUES(city), state = VALUES(state), postal_code = VALUES(postal_code),
                delivery_method = VALUES(delivery_method), payment_method = VALUES(payment_method)',
            [
                $principal->userId,
                (string) ($input['name'] ?? ''), (string) ($input['email'] ?? ''), (string) ($input['mobile'] ?? ''),
                (string) ($input['address'] ?? ''), (string) ($input['city'] ?? ''), (string) ($input['state'] ?? ''),
                (string) ($input['postalCode'] ?? ''),
                in_array((string) ($input['deliveryMethod'] ?? ''), ['standard', 'express'], true) ? (string) $input['deliveryMethod'] : 'standard',
                in_array((string) ($input['paymentMethod'] ?? ''), ['cod', 'card', 'razorpay'], true) ? (string) $input['paymentMethod'] : 'cod',
            ],
        );

        return $this->draft($request);
    }

    private function window(int $from, int $to): string
    {
        return Format::spacedWindow(
            $this->clock->addSeconds($from * 86400),
            $this->clock->addSeconds($to * 86400),
        );
    }

    private function principal(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException();
        }

        return $principal;
    }
}
