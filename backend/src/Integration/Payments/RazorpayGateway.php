<?php

declare(strict_types=1);

namespace Iced\Integration\Payments;

use Iced\Support\Json;
use Iced\Support\Logger;

/**
 * Razorpay — https://razorpay.com/docs/api/
 *
 * Two calls and one hash, which is the whole of a correct integration:
 *
 *   createOrder()  the server states the amount, BEFORE the browser is shown a
 *                  gateway. Razorpay then refuses to take any other figure for
 *                  that order, which is what makes the price un-editable from
 *                  the console of the page paying it.
 *   verify()       the signature the gateway hands back, checked against the
 *                  secret. Until this passes, `razorpay_payment_id` is A STRING
 *                  A BROWSER SENT — anyone can post one.
 *   fetchPayment() what the gateway itself says a payment is, for the console's
 *                  reconciliation screen.
 *
 * The amount-only checkout (no `order_id`) that this replaces opens the same
 * frame and takes a real test payment, so it looks identical on screen; the
 * difference is that nothing it returns can be checked. That is why the secret
 * lives here and never leaves the server: `key_id` is public by design and is
 * read out of the page source on every Razorpay checkout in existence, and
 * `key_secret` is the only thing separating a receipt from a claim.
 */
final class RazorpayGateway
{
    private const API_ROOT = 'https://api.razorpay.com/v1';

    /** Razorpay's own cap — a longer receipt comes back as a 400. */
    private const RECEIPT_MAX = 40;

    /** The smallest amount the gateway will take, in paise. */
    private const MIN_PAISE = 100;

    public function __construct(
        private readonly string $keyId,
        private readonly string $keySecret,
        private readonly int $timeout,
        private readonly Logger $logger,
    ) {
    }

    /** False while either half of the credential is missing. */
    public function isConfigured(): bool
    {
        return $this->keyId !== '' && $this->keySecret !== '';
    }

    /**
     * The PUBLIC half, for the browser that has to open the frame.
     *
     * Served alongside every order this creates rather than configured twice:
     * an `order_id` made under one account and a `key_id` belonging to another
     * is the misconfiguration that produces "No appropriate payment method
     * found" on a gateway where every method is in fact enabled.
     */
    public function keyId(): string
    {
        return $this->keyId;
    }

    /**
     * Creates the order the checkout will be opened against.
     *
     * @param int                   $amountPaise the smallest currency unit, as the API counts
     * @param array<string, string> $notes       echoed back on the payment; 15 keys max
     *
     * @return array<string, mixed> the order entity — `id`, `amount`, `currency`, `status`
     *
     * @throws PaymentGatewayFailed
     */
    public function createOrder(int $amountPaise, string $currency, string $receipt, array $notes = []): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentGatewayFailed('No Razorpay credentials are configured on this server.');
        }

        if ($amountPaise < self::MIN_PAISE) {
            throw new PaymentGatewayFailed('Razorpay will not take a payment that small.');
        }

        $payload = [
            'amount' => $amountPaise,
            'currency' => $currency,
            'receipt' => substr($receipt, 0, self::RECEIPT_MAX),
            // Auto-capture. Left at 0 the money is only AUTHORISED, and an
            // authorisation nobody captures by hand is released days later —
            // a shop that takes payments it never collects.
            'payment_capture' => 1,
        ];

        if ($notes !== []) {
            $payload['notes'] = $notes;
        }

        $order = $this->call('POST', '/orders', $payload);
        $id = $order['id'] ?? null;

        if (!is_string($id) || !str_starts_with($id, 'order_')) {
            throw new PaymentGatewayFailed('Razorpay answered without an order id.', true);
        }

        return $order;
    }

    /**
     * Whether this payment really was made against this order.
     *
     * `hash_equals` rather than `===` because a signature compared with a
     * short-circuiting operator leaks, in its timing, how much of the digest a
     * forgery got right — which is enough to walk it one byte at a time.
     */
    public function verify(string $orderId, string $paymentId, string $signature): bool
    {
        if (!$this->isConfigured() || $orderId === '' || $paymentId === '' || $signature === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $this->keySecret);

        return hash_equals($expected, $signature);
    }

    /**
     * The same check for a webhook body, whose secret is a different one.
     *
     * Unused until the webhook endpoint exists; it lives here so that when it
     * does, the signature logic is not written a second time somewhere else.
     */
    public function verifyWebhook(string $rawBody, string $signature, string $secret): bool
    {
        if ($secret === '' || $signature === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature);
    }

    /**
     * What the gateway holds for a payment — null when it cannot be asked.
     *
     * Null rather than an exception: the console screen that calls this reports
     * "could not be compared", and a reconciliation tool that throws when the
     * network hiccups is a reconciliation tool nobody opens.
     *
     * @return array<string, mixed>|null
     */
    public function fetchPayment(string $paymentId): ?array
    {
        if (!$this->isConfigured() || $paymentId === '') {
            return null;
        }

        try {
            return $this->call('GET', '/payments/' . rawurlencode($paymentId), null);
        } catch (PaymentGatewayFailed $failed) {
            $this->logger->warning('Razorpay payment could not be fetched', [
                'payment' => $paymentId,
                'detail' => $failed->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * One authenticated call, JSON both ways.
     *
     * @param array<string, mixed>|null $payload
     *
     * @return array<string, mixed>
     *
     * @throws PaymentGatewayFailed
     */
    private function call(string $method, string $path, ?array $payload): array
    {
        $handle = curl_init(self::API_ROOT . $path);

        if ($handle === false) {
            throw new PaymentGatewayFailed('Could not open a connection to Razorpay.', true);
        }

        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => $this->timeout,
            // A redirect would carry the Authorization header somewhere it was
            // never meant to go. There is nothing to follow here in any case.
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
            CURLOPT_USERPWD => $this->keyId . ':' . $this->keySecret,
            CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json'],
        ];

        if ($payload !== null) {
            $options[CURLOPT_POSTFIELDS] = Json::encode($payload);
        }

        curl_setopt_array($handle, $options);

        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $transportError = curl_error($handle);
        curl_close($handle);

        if (!is_string($body) || $body === '') {
            $this->logger->warning('Razorpay call failed at the transport', [
                'path' => $path,
                'detail' => $transportError,
            ]);

            throw new PaymentGatewayFailed(
                'Razorpay could not be reached. Check the server internet access and try again.',
                true,
            );
        }

        $decoded = Json::decodeArray($body);

        if ($status >= 200 && $status < 300) {
            if ($decoded === null) {
                throw new PaymentGatewayFailed('Razorpay answered with something that was not JSON.', true);
            }

            /** @var array<string, mixed> $decoded */
            return $decoded;
        }

        /* The credential is never in a Razorpay error body — it names the field
           it disliked, not what was sent — so this is safe to keep, and it is
           the only way to tell "bad key" from "amount too small" after the
           fact. */
        $this->logger->warning('Razorpay refused a call', [
            'path' => $path,
            'status' => $status,
            'body' => substr($body, 0, 400),
        ]);

        throw new PaymentGatewayFailed($this->describe($status, $decoded), $status >= 500 || $status === 429);
    }

    /** @param array<string, mixed>|null $decoded */
    private function describe(int $status, ?array $decoded): string
    {
        if ($status === 401) {
            return 'Razorpay rejected the API key. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.';
        }

        $error = is_array($decoded['error'] ?? null) ? $decoded['error'] : [];
        $description = is_string($error['description'] ?? null) ? $error['description'] : '';

        return $description === ''
            ? sprintf('Razorpay answered %d. Please try again in a moment.', $status)
            : sprintf('Razorpay said: %s', $description);
    }
}
