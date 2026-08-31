<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\ConsoleCustomerPresenter;
use Iced\Presenter\OrderPresenter;
use Iced\Repository\ConsoleCustomerRepository;
use Iced\Repository\OrderRepository;
use Iced\Repository\UserRepository;
use Iced\Support\IdAllocator;
use Iced\Support\Paginator;
use Iced\Support\Validator;

/** Spec §8.26 — console customers (6 endpoints). */
final class CustomerController
{
    public function __construct(
        private readonly ConsoleCustomerRepository $customers,
        private readonly ConsoleCustomerPresenter $presenter,
        private readonly UserRepository $users,
        private readonly OrderRepository $orders,
        private readonly OrderPresenter $orderPresenter,
        private readonly IdAllocator $ids,
    ) {
    }

    /** #153 GET /admin/customers */
    public function index(Request $request): Response
    {
        $page = Paginator::fromRequest($request);

        $result = $this->customers->search([
            'q' => $request->queryString('q'),
            'state' => $request->queryString('state'),
        ], $page);

        return Response::paginated($this->presenter->rows($result['rows']), $page->meta($result['total']));
    }

    /** #154 POST /admin/customers — unique email, id from the reserved band. */
    public function create(Request $request): Response
    {
        /** @var array{name: string, email: string, phone?: string} $input */
        $input = $request->validated();

        if ($this->customers->emailTaken(UserRepository::normalizeEmail($input['email']))) {
            throw ValidationException::field('email', 'A customer already uses that email.', 'ICE-USR-422');
        }

        $publicId = $this->ids->allocate('customer');

        $this->users->create(
            $publicId,
            UserRepository::TYPE_CUSTOMER,
            $input['name'],
            $input['email'],
            '',
            isset($input['phone']) ? (string) (Validator::normalizeMobile((string) $input['phone']) ?? '') : '',
        );

        $request->setAttribute('audit_entity_type', 'customer');
        $request->setAttribute('audit_entity_id', $publicId);

        $row = $this->customers->find($publicId);

        return Response::data($row === null ? [] : $this->presenter->row($row), 201);
    }

    /** #155 GET /admin/customers/{id} */
    public function show(Request $request): Response
    {
        $customer = $this->find($request->routeParam('id'));

        return Response::data([
            'row' => $this->presenter->row($customer),
            'stats' => $this->presenter->stats($customer),
        ]);
    }

    /** #156 PATCH /admin/customers/{id} */
    public function update(Request $request): Response
    {
        $id = $request->routeParam('id');
        $customer = $this->find($id);
        /** @var array{name?: string, phone?: string, state?: string} $input */
        $input = $request->validated();

        $fields = [];

        if (isset($input['name'])) {
            $fields['name'] = $input['name'];
        }

        if (isset($input['phone'])) {
            $normalized = Validator::normalizeMobile((string) $input['phone']);

            if ($normalized === null) {
                throw ValidationException::field('phone', 'Enter a 10-digit Indian mobile number.', 'ICE-USR-422');
            }

            $fields['phone'] = $normalized;
        }

        if (isset($input['state'])) {
            $fields['status'] = $input['state'] === 'Blocked' ? 'BLOCKED' : 'ACTIVE';
        }

        $request->setAttribute('audit_entity_type', 'customer');
        $request->setAttribute('audit_entity_id', $id);
        $request->setAttribute('audit_before', $this->presenter->row($customer));

        $this->customers->update($id, $fields);

        $row = $this->find($id);
        $presented = $this->presenter->row($row);
        $request->setAttribute('audit_after', $presented);

        return Response::data($presented);
    }

    /** #157 GET /admin/customers/{id}/orders — the read-only history table. */
    public function orders(Request $request): Response
    {
        $customer = $this->find($request->routeParam('id'));

        return Response::data($this->orderPresenter->customerHistory($this->orders->forCustomer((int) $customer['id'])));
    }

    /** #158 GET /admin/customers/{id}/activity — sessions and logins, masked. */
    public function activity(Request $request): Response
    {
        $customer = $this->find($request->routeParam('id'));

        return Response::data($this->presenter->activity(
            $this->customers->sessions((int) $customer['id']),
            $this->customers->loginAttempts((string) $customer['email_normalized']),
        ));
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->customers->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-USR-404', 'We could not find that customer.');
        }

        return $row;
    }
}
