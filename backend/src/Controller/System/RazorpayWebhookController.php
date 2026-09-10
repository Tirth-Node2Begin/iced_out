<?php

declare(strict_types=1);

namespace Iced\Controller\System;

use Iced\Integration\Payments\RazorpayGateway;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Repository\PaymentIntentRepository;
use Iced\Repository\WebhookRepository;
use Iced\Support\Config;
use Iced\Support\Json;
use Iced\Support\Logger;
use Iced\Support\SecuritySignals;
use Throwable;

/**
 * POST /webhooks/razorpay — what the GATEWAY says happened.
 *
 * Until this existed, everything the server knew about a payment arrived through
 * the shopper's own browser. That is fine when the browser gets back to us and
 * useless when it does not: a tab closed on the confirmation screen, a phone
 * that lost signal between the bank's page and ours, a laptop that slept. In
 * every one of those the money moved and nothing here heard about it.
 *
 * ── WHAT AUTHORISES THIS REQUEST ────────────────────────────────────────────
 *
 * Not a session — Razorpay has none. An HMAC-SHA256 of the RAW BODY under
 * `RAZORPAY_WEBHOOK_SECRET`, compared with `hash_equals`. That is the whole of
 * the authentication, which is why the raw body is used rather than a re-encoded
 * copy of the parsed one: re-encoding changes key order and whitespace, and the
 * signature would never match again.
 *
 * The secret is a DIFFERENT one from the API key secret. Razorpay issues it when
 * the webhook is registered, and mixing the two is the mistake that produces a
 * signature that is always wrong with no other symptom.
 *
 * ── WHAT THIS ENDPOINT MAY AND MAY NOT DO ───────────────────────────────────
 *
 * It may promote a payment intent from CREATED to VERIFIED, and it may record
 * that a payment failed. It may NOT create an order, mark one paid, release
 * stock, or touch a wallet.
 *
 * That restraint is the point. Order creation stays in `PlaceOrderService`,
 * driven by a shopper who is signed in and has a bag — one path, one
 * transaction, one set of rules. A webhook that could also create orders would
 * be a second checkout with none of the same checks, reachable by anyone who
 * ever learns the secret. What this does instead is make the shopper's own
 * later attempt succeed, because the intent is already verified when they
 * return.
 *
 * ── WHY IT ALMOST ALWAYS ANSWERS 200 ────────────────────────────────────────
 *
 * A non-2xx tells Razorpay to deliver again, for hours. That is right for
 * "we could not store this" and wrong for everything else. An event we do not
 * recognise, an order we have never heard of, a duplicate — all of those are
 * final answers, and repeating them helps nobody. Only a bad signature (400,
 * because it must never look accepted) and a storage failure (500, because a
 * retry genuinely might work) break the rule.
 */
final class RazorpayWebhookController
{
    private const PROVIDER = 'razorpay';

    /** Events acted on. Anything else is stored, logged, and answered 200. */
    private const HANDLED = [
        'payment.captured',
        'payment.failed',
        'order.paid',
        'refund.processed',
        'refund.failed',
    ];

    /* `payment.authorized` is deliberately ABSENT.
       An authorised payment is money HELD, not taken — a capture that later
       fails, or an authorisation nobody captures, is voided days later. Treating
       it as proof left a VERIFIED intent that `PlaceOrderService` would spend on
       a confirmed, stock-reserving, Captured-payment order for money the gateway
       never actually collected. Only `payment.captured` says the money moved. */

    public function __construct(
        private readonly RazorpayGateway $gateway,
        private readonly WebhookRepository $inbox,
        private readonly PaymentIntentRepository $intents,
        private readonly Database $db,
        private readonly Config $config,
        private readonly Logger $logger,
        private readonly SecuritySignals $signals,
    ) {
    }

    public function receive(Request $request): Response
    {
        $secret = $this->config->string('app.razorpay.webhook_secret');

        if ($secret === '') {
            /* Refusing is the only safe answer. Accepting unsigned events
               because no secret is configured would turn this URL into an
               unauthenticated way to mark payments verified — the exact hole the
               endpoint exists to close. 503 rather than 500: it is a
               configuration state, and Razorpay retrying after it is fixed is
               the behaviour we want. */
            $this->logger->error('webhook.unconfigured', [
                'provider' => self::PROVIDER,
                'detail' => 'RAZORPAY_WEBHOOK_SECRET is blank, so no delivery can be verified.',
            ]);

            return Response::envelope([
                'error' => [
                    'code' => 'ICE-WHK-503',
                    'message' => 'Webhooks are not configured on this server.',
                    'retryable' => true,
                ],
            ], 503);
        }

        $body = $request->rawBody;
        $signature = $request->header('x-razorpay-signature');
        $verified = $this->gateway->verifyWebhook($body, $signature, $secret);

        /* The event id is Razorpay's own, and it is what dedupes a retry. When
           the header is missing — it should not be, but a forged request will
           not bother — a hash of the body stands in, so an unsigned flood still
           collapses to one row per distinct body instead of filling the table. */
        $eventId = $request->header('x-razorpay-event-id');

        if ($eventId === '') {
            $eventId = 'body:' . hash('sha256', $body);
        }

        /* ---- AN UNSIGNED BODY IS NOT STORED --------------------------------
           This used to write the full payload to `webhook_inbox.payload`
           (MEDIUMTEXT) BEFORE checking the signature. The route is public and
           the dedupe key for an unsigned request is a hash of the body, so
           flipping one byte defeats it — which made this an unauthenticated
           write-amplification primitive: up to `post_max_size` per request,
           1000 requests a minute per IP, straight into the database volume.
           Filling the disk takes the shop down.

           A rejected delivery is still RECORDED, because a run of forgeries is
           exactly what an operator needs to see. What is not recorded is the
           attacker's chosen bytes: the row keeps the event id and
           `signature_ok = 0`, and the body is replaced with a short note. */
        $stored = $verified ? $body : '{"rejected":"signature did not verify; body not stored"}';

        try {
            $claimed = $this->inbox->claim(self::PROVIDER, $eventId, $stored, $verified);
        } catch (Throwable $error) {
            $this->logger->exception($error, ['stage' => 'webhook.claim', 'event_id' => $eventId]);

            // A retry might genuinely work, so ask for one.
            return Response::envelope([
                'error' => ['code' => 'ICE-WHK-500', 'message' => 'Could not record that event.', 'retryable' => true],
            ], 500);
        }

        if (!$verified) {
            $this->signals->webhookSignatureFailed(self::PROVIDER, [
                'request_id' => $request->requestId(),
                'event_id' => $eventId,
                'ip' => $request->ip,
                // The body is in webhook_inbox; it is not repeated into the log,
                // where it would sit unredacted next to everything else.
            ]);

            return Response::envelope([
                'error' => ['code' => 'ICE-WHK-400', 'message' => 'That signature did not verify.', 'retryable' => false],
            ], 400);
        }

        if (!$claimed) {
            // Already delivered and already handled. Say so and stop.
            return Response::data(['received' => true, 'duplicate' => true]);
        }

        $payload = Json::decodeArray($body);

        if ($payload === null) {
            $this->logger->warning('webhook.unparseable', ['event_id' => $eventId]);
            $this->inbox->markProcessed(self::PROVIDER, $eventId);

            return Response::data(['received' => true, 'handled' => false]);
        }

        $event = is_string($payload['event'] ?? null) ? $payload['event'] : '';

        try {
            $handled = in_array($event, self::HANDLED, true) && $this->apply($event, $payload);
        } catch (Throwable $error) {
            /* The row stays unprocessed on purpose. `console.php sweep` picks it
               up, so a transient database fault does not lose an event that the
               gateway now considers delivered. Answering 200 is deliberate: the
               event IS stored, and asking Razorpay to send it again would give
               us a duplicate the inbox would simply discard. */
            $this->logger->exception($error, ['stage' => 'webhook.apply', 'event' => $event, 'event_id' => $eventId]);

            return Response::data(['received' => true, 'handled' => false]);
        }

        $this->inbox->markProcessed(self::PROVIDER, $eventId);

        return Response::data(['received' => true, 'handled' => $handled]);
    }

    /**
     * Acts on one verified event. True when something actually changed.
     *
     * @param array<array-key, mixed> $payload
     */
    private function apply(string $event, array $payload): bool
    {
        if (str_starts_with($event, 'refund.')) {
            return $this->applyRefund($event, $this->entity($payload, 'refund'));
        }

        $entity = $this->entity($payload, $event === 'order.paid' ? 'order' : 'payment');

        if ($entity === []) {
            return false;
        }

        if ($event === 'payment.failed') {
            $gatewayOrderId = is_string($entity['order_id'] ?? null) ? $entity['order_id'] : '';

            if ($gatewayOrderId === '') {
                return false;
            }

            $intent = $this->intents->findByGatewayOrderId($gatewayOrderId);

            if ($intent === null || (string) $intent['status'] !== PaymentIntentRepository::STATUS_CREATED) {
                return false;
            }

            $this->db->statement(
                'UPDATE payment_intents SET status = ? WHERE razorpay_order_id = ? AND status = ?',
                [PaymentIntentRepository::STATUS_FAILED, $gatewayOrderId, PaymentIntentRepository::STATUS_CREATED],
            );

            return true;
        }

        /* `order.paid` carries the order entity, whose id IS the gateway order
           id; the payment entity carries its own id plus the order it belongs
           to. Both end up at the same promotion. */
        if ($event === 'order.paid') {
            $gatewayOrderId = is_string($entity['id'] ?? null) ? $entity['id'] : '';
            $paymentId = '';
        } else {
            $gatewayOrderId = is_string($entity['order_id'] ?? null) ? $entity['order_id'] : '';
            $paymentId = is_string($entity['id'] ?? null) ? $entity['id'] : '';
        }

        if ($gatewayOrderId === '') {
            return false;
        }

        $intent = $this->intents->findByGatewayOrderId($gatewayOrderId);

        if ($intent === null) {
            /* A gateway order this server never created. Either the webhook
               secret is shared with another deployment pointing at the same
               Razorpay account, or somebody paid against an order made
               elsewhere. Recorded, not acted on. */
            $this->logger->warning('webhook.unknown_gateway_order', [
                'event' => $event,
                'gateway_order' => $gatewayOrderId,
            ]);

            return false;
        }

        $status = (string) $intent['status'];

        /* Already spent on an order. The shopper's own browser got back to us
           first, which is the normal case — the webhook is the safety net, not
           the primary path. Nothing to do, and nothing wrong. */
        if ($status === PaymentIntentRepository::STATUS_CONSUMED) {
            return false;
        }

        if ($status !== PaymentIntentRepository::STATUS_CREATED) {
            return false;
        }

        if ($paymentId === '') {
            // `order.paid` without a payment id to bind: wait for payment.captured.
            return false;
        }

        /* ---- THE AMOUNT IS CHECKED BEFORE THE PROMOTION, AND BLOCKS IT -----
           This used to promote first and compare afterwards, raising a signal
           and carrying on — so an intent for a figure the gateway did not
           actually take was left VERIFIED and spendable on a real order. The
           order of these two statements is the whole control. */
        $paid = is_numeric($entity['amount'] ?? null) ? (int) $entity['amount'] : null;

        if ($paid !== null && $paid !== (int) $intent['amount_paise']) {
            $this->signals->orphanedPayment($paymentId, [
                'gateway_order' => $gatewayOrderId,
                'expected_paise' => (int) $intent['amount_paise'],
                'captured_paise' => $paid,
                'detail' => 'The gateway captured an amount this intent was not created for. Not promoted.',
            ]);

            return false;
        }

        $promoted = $this->intents->markVerifiedByGateway(
            $gatewayOrderId,
            $paymentId,
            is_string($entity['status'] ?? null) ? $entity['status'] : '',
            is_string($entity['method'] ?? null) ? $entity['method'] : '',
        );

        if (!$promoted) {
            return false;
        }

        $this->logger->info('webhook.intent_verified', [
            'event' => $event,
            'gateway_order' => $gatewayOrderId,
            'payment' => $paymentId,
        ]);

        return true;
    }

    /**
     * A refund the GATEWAY says it processed, reconciled against our ledger.
     *
     * Refunds in this application are BOOKKEEPING: `POST /admin/refunds` records
     * an intention and `transitionRefund` moves a status that a person mirrors by
     * hand in the Razorpay dashboard. Nothing calls the gateway's refund API. That
     * is a deliberate business choice and this does not change it — a webhook that
     * started approving refunds would be a second, unaudited approval path.
     *
     * What it does is make DIVERGENCE visible. Two ways the ledger and the
     * gateway can disagree, both silent until now:
     *
     *   money went back that this system has no record of — someone refunded
     *   straight from the dashboard, and the shop's own books still show the
     *   payment as captured in full;
     *
     *   a refund marked Succeeded here that the gateway then FAILED, so the books
     *   say the customer was repaid and they were not.
     *
     * Both are raised as signals for a human. Neither is written to silently.
     *
     * @param array<string, mixed> $entity
     */
    private function applyRefund(string $event, array $entity): bool
    {
        $gatewayPaymentId = is_string($entity['payment_id'] ?? null) ? $entity['payment_id'] : '';
        $refundId = is_string($entity['id'] ?? null) ? $entity['id'] : '';
        $amountPaise = is_numeric($entity['amount'] ?? null) ? (int) $entity['amount'] : 0;

        if ($gatewayPaymentId === '') {
            return false;
        }

        // Our payment row for that gateway payment id — `reference` is where the
        // verified payment id is written by PlaceOrderService.
        $payment = $this->db->selectOne(
            'SELECT p.id, p.public_id, p.amount, p.status, o.number AS order_number
               FROM payments p JOIN orders o ON o.id = p.order_id
              WHERE p.reference = ? LIMIT 1',
            [$gatewayPaymentId],
        );

        if ($payment === null) {
            $this->logger->warning('webhook.refund_for_unknown_payment', [
                'event' => $event,
                'gateway_payment' => $gatewayPaymentId,
                'gateway_refund' => $refundId,
            ]);

            return false;
        }

        if ($event === 'refund.failed') {
            $this->signals->refundDiverged(
                (string) $payment['order_number'],
                'The gateway FAILED a refund. Anything marked refunded here for that payment is wrong.',
                ['gateway_refund' => $refundId, 'payment' => (string) $payment['public_id']],
            );

            return true;
        }

        /* `refund.processed`: money really has gone back. Is there a record of
           it? Anything not Failed counts — a refund still Requested here simply
           has not been ticked off yet, which is normal and not a divergence. */
        $known = $this->db->selectOne(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE payment_id = ? AND status <> 'Failed'",
            [(int) $payment['id']],
        );

        $knownPaise = (int) round(((float) ($known['total'] ?? 0)) * 100);

        if ($knownPaise < $amountPaise) {
            $this->signals->refundDiverged(
                (string) $payment['order_number'],
                sprintf(
                    'The gateway refunded %d paise against this payment; the register accounts for %d.',
                    $amountPaise,
                    $knownPaise,
                ),
                ['gateway_refund' => $refundId, 'payment' => (string) $payment['public_id']],
            );

            return true;
        }

        $this->logger->info('webhook.refund_reconciled', [
            'gateway_refund' => $refundId,
            'payment' => (string) $payment['public_id'],
            'amount_paise' => $amountPaise,
        ]);

        return true;
    }

    /**
     * Razorpay nests entities as `payload.<name>.entity`.
     *
     * @param array<array-key, mixed> $payload
     *
     * @return array<string, mixed>
     */
    private function entity(array $payload, string $name): array
    {
        $inner = $payload['payload'] ?? null;

        if (!is_array($inner) || !is_array($inner[$name] ?? null)) {
            return [];
        }

        $entity = $inner[$name]['entity'] ?? null;

        /** @var array<string, mixed> */
        return is_array($entity) ? $entity : [];
    }
}
