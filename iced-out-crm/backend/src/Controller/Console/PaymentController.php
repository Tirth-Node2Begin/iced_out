<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Integration\Payments\RazorpayGateway;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\PaymentPresenter;
use Iced\Repository\PaymentRepository;
use Iced\Support\Clock;
use Iced\Support\Csv;
use Iced\Support\Paginator;

/** Spec §8.25 — console payments, refunds, payouts (10 endpoints). */
final class PaymentController
{
    public function __construct(
        private readonly PaymentRepository $payments,
        private readonly PaymentPresenter $presenter,
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly RazorpayGateway $gateway,
    ) {
    }

    /**
     * Razorpay's payment states, in the ledger's own words.
     *
     * `created` and `authorized` are both money that has NOT been taken, and
     * the ledger has one word for that. Anything Razorpay adds later falls
     * through to null and is reported verbatim rather than mapped to a guess.
     */
    private const GATEWAY_STATUS = [
        'captured' => 'Captured',
        'refunded' => 'Refunded',
        'failed' => 'Failed',
        'created' => 'Due',
        'authorized' => 'Due',
    ];

    /** #143 GET /admin/payments */
    public function index(Request $request): Response
    {
        $page = Paginator::fromRequest($request);

        $result = $this->payments->search([
            'status' => $request->queryString('status'),
            'gateway' => $request->queryString('gateway'),
            'q' => $request->queryString('q'),
        ], $page);

        return Response::paginated($this->presenter->rows($result['rows']), $page->meta($result['total']));
    }

    /** #144 GET /admin/payments/{id} */
    public function show(Request $request): Response
    {
        $payment = $this->find($request->routeParam('id'));

        return Response::data(
            $this->presenter->row($payment) + [
                'timeline' => $this->presenter->timeline($this->payments->attempts((int) $payment['id'])),
            ],
        );
    }

    /**
     * #145 POST /admin/payments/{id}/collect-cod — the ledger's one verb.
     * Due → Captured, note "Cash collected on delivery".
     */
    public function collectCod(Request $request): Response
    {
        $id = $request->routeParam('id');

        return $this->db->transaction(function () use ($id, $request): Response {
            $payment = $this->find($id);

            if ((string) $payment['status'] === 'Captured') {
                return Response::data($this->presenter->row($payment));
            }

            if ((string) $payment['status'] !== 'Due') {
                throw new ConflictException('ICE-PAY-409', 'Only a payment that is due can be collected.');
            }

            $this->payments->setStatus((int) $payment['id'], 'Captured', 'Cash collected on delivery');
            $this->payments->recordAttempt((int) $payment['id'], 'capture', 'collected on delivery');

            $request->setAttribute('audit_entity_type', 'payment');
            $request->setAttribute('audit_entity_id', $id);

            return Response::data($this->presenter->row($this->find($id)));
        });
    }

    /**
     * #146 POST /admin/payments/{id}/gateway-check.
     *
     * Without gateway credentials configured this reports that it could not
     * reach the gateway rather than inventing agreement — a reconciliation
     * screen that always says "matches" is worse than no screen.
     */
    public function gatewayCheck(Request $request): Response
    {
        $payment = $this->find($request->routeParam('id'));
        $configured = $this->gateway->isConfigured();

        $this->payments->recordAttempt(
            (int) $payment['id'],
            'check',
            $configured ? 'gateway queried' : 'gateway not configured',
        );

        if (!$configured) {
            return Response::data([
                'gateway_status' => null,
                'matches' => null,
                'note' => 'No gateway credentials are configured, so nothing could be compared.',
            ]);
        }

        $reference = (string) ($payment['reference'] ?? '');

        /* Cash on delivery, store credit, a card taken on the device: real
           payments with no gateway behind them. Reporting "matches" for one
           would be inventing agreement with a system that was never asked. */
        if (!str_starts_with($reference, 'pay_')) {
            return Response::data([
                'gateway_status' => null,
                'matches' => null,
                'note' => 'This payment has no Razorpay reference, so there was nothing to compare it with.',
            ]);
        }

        $remote = $this->gateway->fetchPayment($reference);

        if ($remote === null) {
            return Response::data([
                'gateway_status' => null,
                'matches' => null,
                'note' => 'Razorpay could not be reached, so nothing could be compared.',
            ]);
        }

        $mapped = self::GATEWAY_STATUS[(string) ($remote['status'] ?? '')] ?? null;

        return Response::data([
            'gateway_status' => $mapped ?? (string) ($remote['status'] ?? 'unknown'),
            'matches' => $mapped === (string) $payment['status'],
            'note' => $mapped === (string) $payment['status']
                ? ''
                : sprintf(
                    'The ledger says %s and Razorpay says %s.',
                    strtolower((string) $payment['status']),
                    strtolower((string) ($remote['status'] ?? 'nothing')),
                ),
        ]);
    }

    /** #147 GET /admin/refunds */
    public function refunds(Request $request): Response
    {
        return Response::data($this->presenter->refundRows($this->payments->refunds()));
    }

    /** #148 POST /admin/refunds */
    public function createRefund(Request $request): Response
    {
        /** @var array{payment: string, amount: int, reason: string} $input */
        $input = $request->validated();

        $reasons = $this->payments->refundReasons();

        if (!in_array($input['reason'], $reasons, true)) {
            throw ValidationException::field(
                'reason',
                sprintf('Choose one of: %s.', implode(', ', $reasons)),
                'ICE-REF-422',
            );
        }

        $payment = $this->find($input['payment']);
        $asked = Money::fromRupees($input['amount']);

        /* ---- one refund decision at a time, per payment --------------------

           This used to read the refunded total and then insert, with no lock and
           no transaction. Two console requests could both read the same
           remaining balance and both write, and the arithmetic that was supposed
           to stop an over-refund never saw the other one coming.

           Worse than the race was what was being counted: `refundedTotal()` sums
           only `Succeeded` refunds, and every refund is born `Requested`. So the
           check ignored every refund that had been raised and not yet approved —
           three refunds for the full amount could each pass it, and then all
           three could be approved.

           Both are closed here: the payment row is held for the duration, and
           the total counts everything that is not `Failed`. */
        $publicId = $this->db->transaction(function () use ($payment, $asked, $input, $request): string {
            $locked = $this->payments->lockPayment((int) $payment['id']);

            if ($locked === null) {
                throw new NotFoundException('ICE-REF-404', 'We could not find that payment.');
            }

            /* ---- YOU CAN ONLY SEND BACK MONEY YOU ACTUALLY TOOK -------------

               Every guard below this line is about AMOUNT, and each one assumed
               the money had arrived. Nothing asked whether it had.

               `payments.status` is one of Captured, Due, Failed, Refunded.
               Only the first means money was received. `Due` is a
               cash-on-delivery order that has not been collected yet and `Failed`
               is a payment that did not go through — both carry a perfectly good
               `amount`, which is the number the refundable arithmetic works
               from, so both passed every check and produced a refund in
               `Requested`. Approve it and real money leaves the merchant account
               against money that never entered it. The development database has
               five Due and one Failed payment sitting there right now, each
               refundable in full today.

               It reads the LOCKED row, not the one fetched before the
               transaction: `collectCod` flips Due to Captured and a refund
               decision must not be made from a status that was true a moment ago.

               `Refunded` is refused too, and says so in its own words rather
               than as an arithmetic complaint — that status is set only when a
               payment has been refunded in full, so there is nothing left. */
            $status = (string) $locked['status'];

            if ($status !== 'Captured') {
                throw ValidationException::field(
                    'payment',
                    $status === 'Refunded'
                        ? 'That payment has already been refunded in full.'
                        : sprintf('That payment is %s, so there is nothing to refund yet.', strtolower($status)),
                    'ICE-REF-422',
                );
            }

            $committed = Money::fromDecimalString($this->payments->committedRefundTotal((int) $payment['id']));
            $paid = Money::fromDecimalString((string) $locked['amount']);

            if ($committed->plus($asked)->isGreaterThan($paid)) {
                throw ValidationException::field(
                    'amount',
                    sprintf('That is more than the ₹%d still refundable.', $paid->minus($committed)->rupees()),
                    'ICE-REF-422',
                );
            }

            $id = $this->payments->nextRefundId();

            $this->payments->insertRefund(
                $id,
                (int) $payment['id'],
                (string) $payment['order_number'],
                $asked->toDecimalString(),
                $input['reason'],
                $this->actorId($request),
            );

            return $id;
        });

        $request->setAttribute('audit_entity_type', 'refund');
        $request->setAttribute('audit_entity_id', $publicId);

        $row = $this->payments->findRefund($publicId);

        return Response::data($row === null ? [] : $this->presenter->refundRows([$row])[0], 201);
    }

    /** #149 POST /admin/refunds/{id}/transition */
    public function transitionRefund(Request $request): Response
    {
        $id = $request->routeParam('id');
        $refund = $this->payments->findRefund($id);

        if ($refund === null) {
            throw new NotFoundException('ICE-REF-404', 'We could not find that refund.');
        }

        /** @var array{status: string} $input */
        $input = $request->validated();

        $legal = [
            'Requested' => ['Processing', 'Failed'],
            'Processing' => ['Succeeded', 'Failed'],
            'Succeeded' => [],
            'Failed' => ['Processing'],
        ];

        if (!in_array($input['status'], $legal[(string) $refund['status']] ?? [], true)) {
            throw new ConflictException(
                'ICE-REF-409',
                sprintf('A refund that is %s cannot become %s.', strtolower((string) $refund['status']), strtolower($input['status'])),
            );
        }

        return $this->db->transaction(function () use ($id, $refund, $input, $request): Response {
            $paymentId = (int) $refund['payment_id'];

            /* The last gate before money leaves. Creation already checks the
               committed total under this same lock, but a refund can sit in
               `Requested` for days while other refunds are raised and approved
               against the same payment — so the sum is re-proved here, at the
               moment it actually matters, rather than trusted from whenever the
               row happened to be created. */
            if ($input['status'] === 'Succeeded') {
                $locked = $this->payments->lockPayment($paymentId);

                if ($locked !== null) {
                    $paid = Money::fromDecimalString((string) $locked['amount']);
                    $alreadySucceeded = Money::fromDecimalString($this->payments->refundedTotal($paymentId));
                    $thisOne = Money::fromDecimalString((string) $refund['amount']);

                    if ($alreadySucceeded->plus($thisOne)->isGreaterThan($paid)) {
                        throw new ConflictException(
                            'ICE-REF-409',
                            sprintf(
                                'Approving this would refund more than the ₹%d that was taken. ₹%d has already gone back.',
                                $paid->rupees(),
                                $alreadySucceeded->rupees(),
                            ),
                        );
                    }
                }
            }

            $this->payments->setRefundStatus($id, $input['status'], $this->actorId($request));

            if ($input['status'] === 'Succeeded') {
                $payment = $this->db->selectOne('SELECT amount FROM payments WHERE id = ?', [$paymentId]);
                $refunded = Money::fromDecimalString($this->payments->refundedTotal($paymentId));

                // Only a payment refunded in full becomes Refunded — a partial
                // one is still a captured payment with money back against it.
                if ($payment !== null && !Money::fromDecimalString((string) $payment['amount'])->isGreaterThan($refunded)) {
                    $this->payments->setStatus($paymentId, 'Refunded', 'Refunded in full');
                }

                $this->payments->recordAttempt($paymentId, 'refund', 'refund succeeded');
            }

            $request->setAttribute('audit_entity_type', 'refund');
            $request->setAttribute('audit_entity_id', $id);

            $row = $this->payments->findRefund($id);

            return Response::data($row === null ? [] : $this->presenter->refundRows([$row])[0]);
        });
    }

    /** #150 GET /admin/payouts */
    public function payouts(Request $request): Response
    {
        return Response::data($this->presenter->payoutRows($this->payments->payouts()));
    }

    /** #151 POST /admin/payouts/{id}/mark-paid */
    public function markPayoutPaid(Request $request): Response
    {
        $id = $request->routeParam('id');
        $payout = $this->payments->findPayout($id);

        if ($payout === null) {
            throw new NotFoundException('ICE-PAY-404', 'We could not find that payout.');
        }

        if ((string) $payout['status'] === 'Paid') {
            return Response::data($this->presenter->payoutRows([$payout])[0]);
        }

        $this->payments->markPayoutPaid($id);

        $request->setAttribute('audit_entity_type', 'payout');
        $request->setAttribute('audit_entity_id', $id);

        $row = $this->payments->findPayout($id);

        return Response::data($row === null ? [] : $this->presenter->payoutRows([$row])[0]);
    }

    /** #152 GET /admin/payments/export — CSV, rate-limited 5/hour. */
    public function export(Request $request): Response
    {
        $from = $request->queryString('from', $this->clock->addSeconds(-30 * 86400)->format('Y-m-d')) . ' 00:00:00';
        $to = $request->queryString('to', $this->clock->now()->format('Y-m-d')) . ' 23:59:59';

        $handle = fopen('php://temp', 'r+');

        if ($handle === false) {
            throw new ConflictException('ICE-RPT-409', 'The export could not be started.');
        }

        fputcsv($handle, ['payment_id', 'order', 'gateway', 'method', 'amount', 'status', 'reference', 'created_at']);

        foreach ($this->payments->forExport($from, $to) as $row) {
            /* Csv::row, because a spreadsheet treats a cell starting `=`, `+`,
               `-` or `@` as a formula and `reference` is not ours: on the
               non-captured path PlaceOrderService takes it from the checkout
               request body. An anonymous cash-on-delivery order is enough to put
               `=HYPERLINK(...)` in this column and have it run on the finance
               workstation that opens the month's export. See Support\Csv. */
            fputcsv($handle, Csv::row([
                $row['public_id'],
                $row['order_number'],
                $row['gateway'],
                $row['method'],
                $row['amount'],
                $row['status'],
                $row['reference'],
                $row['created_at'],
            ]));
        }

        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);

        return Response::raw($csv, 'text/csv; charset=utf-8', 200, [
            'Content-Disposition' => 'attachment; filename="payments.csv"',
        ]);
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->payments->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-PAY-404', 'We could not find that payment.');
        }

        return $row;
    }

    private function actorId(Request $request): ?int
    {
        $principal = $request->attribute('principal');

        return $principal instanceof Principal ? $principal->userId : null;
    }
}
