<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Integration\Payments\PaymentGatewayFailed;
use Iced\Integration\Payments\RazorpayGateway;
use Iced\Kernel\Exception\ServiceUnavailableException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Repository\PaymentIntentRepository;
use Iced\Support\Config;
use Iced\Support\Logger;

/**
 * The two halves of a Razorpay payment that must happen on a server.
 *
 * Everything else about the gateway is the browser's job and is fine there —
 * opening the frame, taking the card, showing the result. These two are not,
 * because both depend on the SECRET:
 *
 *   POST /checkout/payments/razorpay/order   states the amount before the
 *       shopper is shown a gateway, so the figure cannot be edited from the
 *       console of the page that pays it.
 *   POST /checkout/payments/razorpay/verify  checks the signature the gateway
 *       hands back. Before it passes, `razorpay_payment_id` is a string a
 *       browser sent — it proves nothing at all.
 *
 * Order creation is allowed to FAIL SOFT: a checkout that cannot reach this
 * endpoint falls back to the amount-only flow in the browser and still opens a
 * real gateway. Verification is not — an unverified payment is reported as
 * unverified and the order records it as such.
 */
final class PaymentController
{
    public function __construct(
        private readonly RazorpayGateway $gateway,
        private readonly PaymentIntentRepository $intents,
        private readonly Config $config,
        private readonly Logger $logger,
    ) {
    }

    /**
     * POST /checkout/payments/razorpay/order
     *
     * `amount` arrives in RUPEES, like every other figure this app passes
     * around; paise exist inside the gateway and nowhere else.
     */
    public function createOrder(Request $request): Response
    {
        if (!$this->gateway->isConfigured()) {
            throw new ServiceUnavailableException(
                'Card payments are not configured on this server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.',
                'ICE-PAY-503',
            );
        }

        $principal = $this->principal($request);

        /** @var array{amount: int, receipt?: string} $input */
        $input = $request->validated();

        $currency = $this->config->string('app.currency', 'INR');
        $amountPaise = (int) $input['amount'] * 100;

        try {
            $order = $this->gateway->createOrder(
                $amountPaise,
                $currency,
                (string) ($input['receipt'] ?? 'iced-out'),
                $this->notes($request),
            );
        } catch (PaymentGatewayFailed $failed) {
            throw new ServiceUnavailableException($failed->getMessage(), 'ICE-PAY-503');
        }

        /* ---- the server's own record of what is about to be paid -----------

           The figure above is the BROWSER's, and it stays the browser's: this
           endpoint receives an amount, not a bag, so re-pricing here would mean
           changing what the request carries. Recording it costs nothing and is
           what makes the amount checkable later — `PlaceOrderService` refuses to
           settle an order against an intent whose amount is not exactly what the
           bag came to when priced from the catalogue.

           So a client that asks the gateway for ₹1 gets an intent for ₹1 and an
           order that will not accept it. The gateway figure is not trusted; it
           is WITNESSED, which is the part that was missing.

           The gateway's own echoed amount is preferred over ours — if Razorpay
           ever normalised the figure, the intent must record what will actually
           be charged, not what we asked for. */
        $this->intents->create(
            (string) $order['id'],
            $principal->userId,
            is_numeric($order['amount'] ?? null) ? (int) $order['amount'] : $amountPaise,
            is_string($order['currency'] ?? null) ? (string) $order['currency'] : $currency,
        );

        return Response::data([
            'id' => (string) $order['id'],
            // Echoed back in the gateway's own unit, so the browser opens the
            // checkout with exactly the figure the order was created for.
            'amount' => (int) ($order['amount'] ?? 0),
            'currency' => (string) ($order['currency'] ?? 'INR'),
            /* The public key travels WITH the order it belongs to. A key from
               one account and an order id from another is the misconfiguration
               that shows the shopper "No appropriate payment method found" on
               a gateway where every method is enabled. */
            'key_id' => $this->gateway->keyId(),
        ], 201);
    }

    /**
     * POST /checkout/payments/razorpay/verify
     *
     * Answers 200 either way. A forged signature is not a broken request — it
     * is a payment that did not happen, and the caller records it as failed.
     */
    public function verify(Request $request): Response
    {
        $principal = $this->principal($request);

        /** @var array{orderId: string, paymentId: string, signature: string} $input */
        $input = $request->validated();

        $orderId = (string) $input['orderId'];
        $paymentId = (string) $input['paymentId'];

        $verified = $this->gateway->verify($orderId, $paymentId, (string) $input['signature']);

        if (!$verified) {
            /* The intent is retired rather than left open. A forged signature is
               not a payment, and leaving the row in CREATED would let a second,
               honest attempt against the same gateway order look like the first
               one had never been challenged. */
            $this->intents->markFailed($orderId, $principal->userId);
            $this->logger->warning('payment.signature_failed', [
                'request_id' => $request->requestId(),
                'gateway_order' => $orderId,
                'user' => $principal->publicId,
            ]);

            return $this->verdict(false, null);
        }

        /* What the GATEWAY says it holds, not what the browser claimed. A valid
           signature proves the payment id belongs to this order; only this says
           the money was actually captured. Null when Razorpay cannot be reached
           in the second or two after a payment — the signature already stands
           on its own, so a missing status is reported, never guessed. */
        $payment = $this->gateway->fetchPayment($paymentId);

        /* ---- promote the intent -------------------------------------------

           THIS is the line the whole change exists for. Until now the signature
           was checked, the answer was handed to the browser, and the server kept
           no record — so `POST /checkout/orders` had nothing to consult and took
           the browser's word instead.

           Scoped to the principal, conditional on status CREATED, and guarded by
           a unique index on the payment id, so: another customer's intent cannot
           be promoted, a second call changes nothing, and one payment id can
           never back two intents.

           A refusal here is NOT reported to the caller as an unverified payment.
           The signature is genuine; what failed is our own bookkeeping — an
           expired intent, or a replay. Saying `verified: false` would tell a
           shopper who really was charged that nothing happened. The order they
           then place finds no claimable intent and is written unpaid, which is
           the safe outcome, and the log line below is what an operator
           reconciles from. */
        if (!$this->intents->markVerified(
            $orderId,
            $principal->userId,
            $paymentId,
            is_string($payment['status'] ?? null) ? $payment['status'] : '',
            is_string($payment['method'] ?? null) ? $payment['method'] : '',
        )) {
            $this->logger->warning('payment.intent_not_promoted', [
                'request_id' => $request->requestId(),
                'gateway_order' => $orderId,
                'user' => $principal->publicId,
                'reason' => 'no CREATED intent for this order, or the payment id is already bound',
            ]);
        }

        return $this->verdict(true, $payment);
    }

    /**
     * The verify response, in one place so both exits share a shape.
     *
     * The envelope is byte-for-byte what it was before intents existed — four
     * keys, same names, same units. Nothing about the record kept behind it is
     * visible to the caller, and nothing needs to be: the browser's job is to
     * show the shopper an outcome, and the server's is to remember it.
     *
     * @param array<string, mixed>|null $payment
     */
    private function verdict(bool $verified, ?array $payment): Response
    {
        return Response::data([
            'verified' => $verified,
            'status' => is_string($payment['status'] ?? null) ? $payment['status'] : null,
            'amount' => isset($payment['amount']) && is_numeric($payment['amount'])
                ? (int) ((int) $payment['amount'] / 100)
                : null,
            'method' => is_string($payment['method'] ?? null) ? $payment['method'] : null,
        ]);
    }

    /**
     * The signed-in shopper. Both endpoints are customer-audience routes, so the
     * pipeline has already refused anyone without a session — this is the
     * narrowing from `mixed`, not a second check.
     */
    private function principal(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException('Please sign in to continue.');
        }

        return $principal;
    }

    /**
     * The free-text the gateway echoes back on the payment.
     *
     * Read off the raw body rather than the validated input because the rule
     * language has no shape for a map. Everything is forced to a string and the
     * set is capped at Razorpay's own 15 keys, so a caller cannot push anything
     * unbounded through the note field.
     *
     * @return array<string, string>
     */
    private function notes(Request $request): array
    {
        $given = $request->body()['notes'] ?? null;

        if (!is_array($given)) {
            return [];
        }

        $notes = [];

        foreach ($given as $key => $value) {
            if (count($notes) >= 15) {
                break;
            }

            if (is_string($key) && is_scalar($value)) {
                $notes[substr($key, 0, 40)] = substr((string) $value, 0, 200);
            }
        }

        return $notes;
    }
}
