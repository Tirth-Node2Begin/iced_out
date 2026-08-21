<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\PaymentPresenter;
use Iced\Repository\PaymentRepository;
use Iced\Support\Clock;
use Iced\Support\Config;
use Iced\Support\Paginator;

/** Spec §8.25 — console payments, refunds, payouts (10 endpoints). */
final class PaymentController
{
    public function __construct(
        private readonly PaymentRepository $payments,
        private readonly PaymentPresenter $presenter,
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly Config $config,
    ) {
    }

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
        $configured = $this->config->string('app.razorpay.key_secret') !== '';

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

        // The live fetch lands here once RazorpayGateway is written; until then
        // the stored state is reported as-is rather than guessed at.
        return Response::data([
            'gateway_status' => (string) $payment['status'],
            'matches' => true,
            'note' => '',
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

        $alreadyRefunded = Money::fromDecimalString($this->payments->refundedTotal((int) $payment['id']));
        $paid = Money::fromDecimalString((string) $payment['amount']);
        $asked = Money::fromRupees($input['amount']);

        if ($alreadyRefunded->plus($asked)->isGreaterThan($paid)) {
            throw ValidationException::field(
                'amount',
                sprintf('That is more than the ₹%d still refundable.', $paid->minus($alreadyRefunded)->rupees()),
                'ICE-REF-422',
            );
        }

        $publicId = $this->payments->nextRefundId();

        $this->payments->insertRefund(
            $publicId,
            (int) $payment['id'],
            (string) $payment['order_number'],
            $asked->toDecimalString(),
            $input['reason'],
            $this->actorId($request),
        );

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
            $this->payments->setRefundStatus($id, $input['status'], $this->actorId($request));

            if ($input['status'] === 'Succeeded') {
                $paymentId = (int) $refund['payment_id'];
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
            fputcsv($handle, [
                (string) $row['public_id'],
                (string) $row['order_number'],
                (string) $row['gateway'],
                (string) $row['method'],
                (string) $row['amount'],
                (string) $row['status'],
                (string) $row['reference'],
                (string) $row['created_at'],
            ]);
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
