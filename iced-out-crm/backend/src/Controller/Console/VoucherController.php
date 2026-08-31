<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Money;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\VoucherPresenter;
use Iced\Repository\ConsoleCustomerRepository;
use Iced\Repository\VoucherRepository;
use Iced\Support\Clock;

/** Spec §8.24 — console vouchers (4 endpoints), permission `coupons.manage`. */
final class VoucherController
{
    public function __construct(
        private readonly VoucherRepository $vouchers,
        private readonly VoucherPresenter $presenter,
        private readonly ConsoleCustomerRepository $customers,
        private readonly Clock $clock,
    ) {
    }

    /** #139 GET /admin/vouchers */
    public function index(Request $request): Response
    {
        return Response::data($this->presenter->consoleRows($this->vouchers->search([
            'q' => $request->queryString('q'),
            'state' => $request->queryString('state'),
        ])));
    }

    /** #140 POST /admin/vouchers — hand-issued, so returnId stays empty. */
    public function create(Request $request): Response
    {
        /** @var array{customer: string, amount: int, reason: string, expiresOn: string} $input */
        $input = $request->validated();

        $today = $this->clock->display($this->clock->now())->format('Y-m-d');

        // The register's own rule: an expiry that is not after the issue date is
        // a voucher nobody can spend.
        if ($input['expiresOn'] <= $today) {
            throw ValidationException::field('expiresOn', 'The expiry has to be after today.', 'ICE-CPN-422');
        }

        $customer = $this->customers->find($input['customer']);
        $code = $this->vouchers->nextHandIssuedCode();

        $this->vouchers->issue(
            $code,
            Money::fromRupees($input['amount'])->toDecimalString(),
            $input['reason'],
            $customer === null ? $input['customer'] : (string) $customer['name'],
            $customer === null ? null : (int) $customer['id'],
            $today,
            $input['expiresOn'],
        );

        $request->setAttribute('audit_entity_type', 'voucher');
        $request->setAttribute('audit_entity_id', $code);

        $row = $this->vouchers->find($code);

        return Response::data($row === null ? [] : $this->presenter->consoleRow($row), 201);
    }

    /** #141 PATCH /admin/vouchers/{code} — only while unclaimed. */
    public function update(Request $request): Response
    {
        $code = $request->routeParam('code');
        $voucher = $this->find($code);

        if (($voucher['claimed_on'] ?? null) !== null) {
            throw new ConflictException('ICE-CPN-409', 'That voucher has already been spent.');
        }

        /** @var array{amount?: int, reason?: string, expiresOn?: string} $input */
        $input = $request->validated();
        $fields = [];

        if (isset($input['amount'])) {
            $fields['amount'] = Money::fromRupees($input['amount'])->toDecimalString();
        }

        if (isset($input['reason'])) {
            $fields['reason'] = $input['reason'];
        }

        if (isset($input['expiresOn'])) {
            if ($input['expiresOn'] <= (string) $voucher['issued_on']) {
                throw ValidationException::field('expiresOn', 'The expiry has to be after the issue date.', 'ICE-CPN-422');
            }

            $fields['expires_on'] = $input['expiresOn'];
        }

        $request->setAttribute('audit_entity_type', 'voucher');
        $request->setAttribute('audit_entity_id', $code);

        $this->vouchers->update($code, $fields);

        $row = $this->find($code);

        return Response::data($this->presenter->consoleRow($row));
    }

    /** #142 DELETE /admin/vouchers/{code} — void while unclaimed. */
    public function void(Request $request): Response
    {
        $code = $request->routeParam('code');
        $voucher = $this->find($code);

        if (($voucher['claimed_on'] ?? null) !== null) {
            throw new ConflictException('ICE-CPN-409', 'A voucher that has been spent cannot be voided.');
        }

        $this->vouchers->void($code);

        $request->setAttribute('audit_entity_type', 'voucher');
        $request->setAttribute('audit_entity_id', $code);

        return Response::noContent();
    }

    /** @return array<string, mixed> */
    private function find(string $code): array
    {
        $row = $this->vouchers->find($code);

        if ($row === null) {
            throw new NotFoundException('ICE-CPN-404', 'We could not find that voucher.');
        }

        return $row;
    }
}
