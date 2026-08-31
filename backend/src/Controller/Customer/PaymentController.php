<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Integration\Payments\PaymentGatewayFailed;
use Iced\Integration\Payments\RazorpayGateway;
use Iced\Kernel\Exception\ServiceUnavailableException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Config;

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
        private readonly Config $config,
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

        /** @var array{amount: int, receipt?: string} $input */
        $input = $request->validated();

        try {
            $order = $this->gateway->createOrder(
                (int) $input['amount'] * 100,
                $this->config->string('app.currency', 'INR'),
                (string) ($input['receipt'] ?? 'iced-out'),
                $this->notes($request),
            );
        } catch (PaymentGatewayFailed $failed) {
            throw new ServiceUnavailableException($failed->getMessage(), 'ICE-PAY-503');
        }

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
        /** @var array{orderId: string, paymentId: string, signature: string} $input */
        $input = $request->validated();

        $verified = $this->gateway->verify(
            (string) $input['orderId'],
            (string) $input['paymentId'],
            (string) $input['signature'],
        );

        if (!$verified) {
            return Response::data([
                'verified' => false,
                'status' => null,
                'amount' => null,
                'method' => null,
            ]);
        }

        /* What the GATEWAY says it holds, not what the browser claimed. A valid
           signature proves the payment id belongs to this order; only this says
           the money was actually captured. Null when Razorpay cannot be reached
           in the second or two after a payment — the signature already stands
           on its own, so a missing status is reported, never guessed. */
        $payment = $this->gateway->fetchPayment((string) $input['paymentId']);

        return Response::data([
            'verified' => true,
            'status' => is_string($payment['status'] ?? null) ? $payment['status'] : null,
            'amount' => isset($payment['amount']) && is_numeric($payment['amount'])
                ? (int) ((int) $payment['amount'] / 100)
                : null,
            'method' => is_string($payment['method'] ?? null) ? $payment['method'] : null,
        ]);
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
