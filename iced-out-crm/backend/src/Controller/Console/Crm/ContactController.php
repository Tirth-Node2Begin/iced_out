<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CrmPresenter;
use Iced\Presenter\Format;
use Iced\Repository\Crm\ActivityRepository;
use Iced\Repository\Crm\CompanyRepository;
use Iced\Repository\Crm\ContactRepository;
use Iced\Repository\Crm\DealRepository;
use Iced\Repository\Crm\NoteRepository;
use Iced\Support\Clock;

/** Contacts — the people the shop knows, whether or not they have ever bought. */
final class ContactController extends CrmController
{
    public function __construct(
        private readonly ContactRepository $contacts,
        private readonly CompanyRepository $companies,
        private readonly DealRepository $deals,
        private readonly ActivityRepository $activities,
        private readonly NoteRepository $notes,
        private readonly CrmPresenter $presenter,
        private readonly Clock $clock,
        Database $db,
    ) {
        parent::__construct($db);
    }

    /** GET /admin/crm/contacts */
    public function index(Request $request): Response
    {
        $rows = $this->contacts->search([
            'lifecycle' => $request->queryString('lifecycle', 'all'),
            'owner' => $request->queryString('owner', 'all'),
            'company' => $request->queryString('company', 'all'),
            'q' => $request->queryString('q'),
        ]);

        return Response::data([
            'contacts' => $this->presenter->map($rows, 'contact'),
            'counts' => (object) $this->contacts->lifecycleCounts(),
        ]);
    }

    /**
     * GET /admin/crm/contacts/{contact}
     *
     * The record AND everything hanging off it in one response. A detail screen
     * that fires five requests shows five loading states and settles at the speed
     * of the slowest — this is one round trip and one paint.
     */
    public function show(Request $request): Response
    {
        $contact = $this->find($request->routeParam('contact'));
        $id = (int) $contact['id'];

        return Response::data([
            'contact' => $this->presenter->contact($contact),
            'deals' => $this->presenter->map($this->deals->forContact($id), 'deal'),
            'activities' => $this->presenter->map(
                $this->activities->search(['subjectType' => 'contact', 'subjectId' => $id]),
                'activity',
            ),
            'notes' => $this->presenter->map($this->notes->forSubject('contact', $id), 'note'),
            'orders' => $this->orders($contact),
        ]);
    }

    /** POST /admin/crm/contacts */
    public function store(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $email = $this->str($input, 'email');

        if ($email !== '' && $this->contacts->findByEmail($email) !== null) {
            throw new ConflictException('ICE-CRM-409', 'A contact with that email address already exists.');
        }

        $created = $this->contacts->create([
            'firstName' => $this->str($input, 'firstName'),
            'lastName' => $this->str($input, 'lastName'),
            'email' => $email,
            'phone' => $this->str($input, 'phone'),
            'jobTitle' => $this->str($input, 'jobTitle'),
            'lifecycle' => strtoupper($this->str($input, 'lifecycle', 'LEAD')) ?: 'LEAD',
            'source' => strtoupper($this->str($input, 'source', 'OTHER')) ?: 'OTHER',
            'city' => $this->str($input, 'city'),
            'state' => $this->str($input, 'state'),
            'country' => $this->str($input, 'country', 'India') ?: 'India',
            'companyId' => $this->companyId($this->str($input, 'company')),
            'userId' => $this->customerId($this->str($input, 'customer')),
            'ownerId' => $this->ownerId($request, $this->str($input, 'owner')),
        ]);

        $this->audit($request, 'crm_contact', $created['publicId']);

        return Response::data(
            ['contact' => $this->presenter->contact($this->find($created['publicId']))],
            201,
        );
    }

    /** PATCH /admin/crm/contacts/{contact} */
    public function update(Request $request): Response
    {
        $publicId = $request->routeParam('contact');
        $contact = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $changes = ['updated_at' => $this->clock->nowString()];

        $simple = [
            'firstName' => 'first_name',
            'lastName' => 'last_name',
            'phone' => 'phone',
            'jobTitle' => 'job_title',
            'city' => 'city',
            'state' => 'state',
            'country' => 'country',
        ];

        foreach ($simple as $key => $column) {
            if ($this->has($input, $key)) {
                $changes[$column] = $this->str($input, $key);
            }
        }

        if ($this->has($input, 'email')) {
            $email = $this->str($input, 'email');
            $duplicate = $email === '' ? null : $this->contacts->findByEmail($email);

            if ($duplicate !== null && (int) $duplicate['id'] !== (int) $contact['id']) {
                throw new ConflictException('ICE-CRM-409', 'Another contact already uses that email address.');
            }

            $changes['email'] = $email;
            $changes['email_normalized'] = mb_strtolower($email);
        }

        foreach (['lifecycle', 'source'] as $key) {
            if ($this->has($input, $key)) {
                $changes[$key] = strtoupper($this->str($input, $key));
            }
        }

        if ($this->has($input, 'company')) {
            $changes['company_id'] = $this->companyId($this->str($input, 'company'));
        }

        if ($this->has($input, 'customer')) {
            $changes['user_id'] = $this->customerId($this->str($input, 'customer'));
        }

        if ($this->has($input, 'owner')) {
            $changes['owner_user_id'] = $this->ownerId($request, $this->str($input, 'owner'));
        }

        $this->contacts->update((int) $contact['id'], $changes);
        $this->audit($request, 'crm_contact', $publicId);

        return Response::data(['contact' => $this->presenter->contact($this->find($publicId))]);
    }

    /** DELETE /admin/crm/contacts/{contact} */
    public function destroy(Request $request): Response
    {
        $publicId = $request->routeParam('contact');
        $contact = $this->find($publicId);

        $this->contacts->softDelete((int) $contact['id']);
        $this->audit($request, 'crm_contact', $publicId);

        return Response::noContent();
    }

    /**
     * GET /admin/crm/contacts/importable
     *
     * Shoppers with an account and no contact record. This is the answer to "the
     * CRM was installed after the shop had already been trading" — the storefront
     * already knows these people, and retyping them would be absurd.
     */
    public function importable(Request $request): Response
    {
        $rows = $this->contacts->unlinkedCustomers($request->queryInt('limit', 200));

        return Response::data([
            'customers' => array_map(static fn (array $row): array => [
                'id' => (string) $row['public_id'],
                'name' => (string) $row['name'],
                'email' => (string) $row['email'],
                'phone' => (string) $row['phone'],
                'ordersCount' => (int) $row['orders_count'],
                'ordersTotal' => '₹' . Format::groupIndian((int) round((float) $row['orders_total'])),
            ], $rows),
        ]);
    }

    /**
     * POST /admin/crm/contacts/import
     *
     * Turns the chosen shopper accounts into contacts, linked by user_id.
     * Anyone already linked is SKIPPED rather than failing the batch — two
     * operators importing the same list at once must not produce an error and a
     * half-finished import.
     */
    public function import(Request $request): Response
    {
        /** @var array{customers?: list<string>, owner?: string} $input */
        $input = $request->validated();
        $ids = is_array($input['customers'] ?? null) ? $input['customers'] : [];

        if ($ids === []) {
            throw new ConflictException('ICE-CRM-409', 'Choose at least one customer to import.');
        }

        $ownerId = $this->ownerId($request, $this->str($input, 'owner'));

        return $this->db->transaction(function () use ($ids, $ownerId, $request): Response {
            $created = 0;
            $skipped = 0;

            foreach ($ids as $publicId) {
                $user = $this->db->selectOne(
                    'SELECT id, name, email, phone FROM users
                      WHERE public_id = ? AND type = ? AND deleted_at IS NULL LIMIT 1',
                    [(string) $publicId, 'CUSTOMER'],
                );

                if ($user === null) {
                    ++$skipped;

                    continue;
                }

                $already = $this->db->selectOne(
                    'SELECT id FROM crm_contacts WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
                    [(int) $user['id']],
                );

                if ($already !== null) {
                    ++$skipped;

                    continue;
                }

                [$first, $last] = $this->splitName((string) $user['name']);

                $this->contacts->create([
                    'firstName' => $first,
                    'lastName' => $last,
                    'email' => (string) $user['email'],
                    'phone' => (string) $user['phone'],
                    'jobTitle' => '',
                    /* They have bought from the shop — that is what CUSTOMER
                       means here, and it is the whole reason they are on this
                       list rather than in leads. */
                    'lifecycle' => 'CUSTOMER',
                    'source' => 'IMPORT',
                    'city' => '',
                    'state' => '',
                    'country' => 'India',
                    'companyId' => null,
                    'userId' => (int) $user['id'],
                    'ownerId' => $ownerId,
                ]);

                ++$created;
            }

            $this->audit($request, 'crm_contact', sprintf('import:%d', $created));

            return Response::data(['created' => $created, 'skipped' => $skipped]);
        });
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->contacts->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That contact could not be found.');
        }

        return $row;
    }

    /**
     * @param array<string, mixed> $contact
     *
     * @return list<array<string, string>>
     */
    private function orders(array $contact): array
    {
        $rows = $this->contacts->orders(
            $contact['user_id'] === null ? null : (int) $contact['user_id'],
            (string) $contact['email'],
        );

        return array_map(static function (array $row): array {
            $placed = Format::parse((string) ($row['placed_at'] ?? ''));

            return [
                'id' => (string) $row['public_id'],
                'number' => (string) $row['number'],
                'status' => (string) $row['status'],
                'state' => (string) $row['console_state'],
                'total' => '₹' . Format::groupIndian((int) round((float) $row['total'])),
                'placedAt' => $placed === null ? '' : Format::longDate($placed),
            ];
        }, $rows);
    }

    private function companyId(string $publicId): ?int
    {
        if ($publicId === '' || $publicId === 'none') {
            return null;
        }

        $row = $this->companies->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That company could not be found.');
        }

        return (int) $row['id'];
    }

    /** Links this contact to a storefront account — always a deliberate act. */
    private function customerId(string $publicId): ?int
    {
        if ($publicId === '' || $publicId === 'none') {
            return null;
        }

        $row = $this->db->selectOne(
            'SELECT id FROM users WHERE public_id = ? AND type = ? AND deleted_at IS NULL LIMIT 1',
            [$publicId, 'CUSTOMER'],
        );

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That customer account could not be found.');
        }

        return (int) $row['id'];
    }

    /** @return array{0: string, 1: string} */
    private function splitName(string $name): array
    {
        $trimmed = trim($name);
        $space = strpos($trimmed, ' ');

        if ($space === false) {
            return [$trimmed, ''];
        }

        return [substr($trimmed, 0, $space), trim(substr($trimmed, $space + 1))];
    }
}
