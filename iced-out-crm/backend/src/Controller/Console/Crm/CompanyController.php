<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CrmPresenter;
use Iced\Repository\Crm\ActivityRepository;
use Iced\Repository\Crm\CompanyRepository;
use Iced\Repository\Crm\ContactRepository;
use Iced\Repository\Crm\DealRepository;
use Iced\Repository\Crm\NoteRepository;
use Iced\Support\Clock;

/** Companies — the accounts contacts belong to, and deals are billed against. */
final class CompanyController extends CrmController
{
    public function __construct(
        private readonly CompanyRepository $companies,
        private readonly ContactRepository $contacts,
        private readonly DealRepository $deals,
        private readonly ActivityRepository $activities,
        private readonly NoteRepository $notes,
        private readonly CrmPresenter $presenter,
        private readonly Clock $clock,
        Database $db,
    ) {
        parent::__construct($db);
    }

    /** GET /admin/crm/companies */
    public function index(Request $request): Response
    {
        $rows = $this->companies->search([
            'status' => $request->queryString('status', 'ACTIVE'),
            'owner' => $request->queryString('owner', 'all'),
            'q' => $request->queryString('q'),
        ]);

        return Response::data(['companies' => $this->presenter->map($rows, 'company')]);
    }

    /** GET /admin/crm/companies/options — {id, name} for the pickers. */
    public function options(Request $request): Response
    {
        return Response::data([
            'companies' => array_map(static fn (array $row): array => [
                'id' => (string) $row['public_id'],
                'name' => (string) $row['name'],
            ], $this->companies->options()),
        ]);
    }

    /** GET /admin/crm/companies/{company} */
    public function show(Request $request): Response
    {
        $company = $this->find($request->routeParam('company'));
        $id = (int) $company['id'];

        return Response::data([
            'company' => $this->presenter->company($company),
            'contacts' => $this->presenter->map($this->contacts->search(['company' => (string) $company['public_id']]), 'contact'),
            'deals' => $this->presenter->map($this->deals->forCompany($id), 'deal'),
            'activities' => $this->presenter->map(
                $this->activities->search(['subjectType' => 'company', 'subjectId' => $id]),
                'activity',
            ),
            'notes' => $this->presenter->map($this->notes->forSubject('company', $id), 'note'),
        ]);
    }

    /** POST /admin/crm/companies */
    public function store(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $name = $this->str($input, 'name');

        if ($this->companies->findByName($name) !== null) {
            throw new ConflictException('ICE-CRM-409', 'A company with that name already exists.');
        }

        $created = $this->companies->create([
            'name' => $name,
            'domain' => $this->str($input, 'domain'),
            'industry' => $this->str($input, 'industry'),
            'sizeBand' => $this->str($input, 'sizeBand'),
            'email' => $this->str($input, 'email'),
            'phone' => $this->str($input, 'phone'),
            'website' => $this->str($input, 'website'),
            'city' => $this->str($input, 'city'),
            'state' => $this->str($input, 'state'),
            'country' => $this->str($input, 'country', 'India') ?: 'India',
            'ownerId' => $this->ownerId($request, $this->str($input, 'owner')),
        ]);

        $this->audit($request, 'crm_company', $created['publicId']);

        return Response::data(
            ['company' => $this->presenter->company($this->find($created['publicId']))],
            201,
        );
    }

    /** PATCH /admin/crm/companies/{company} */
    public function update(Request $request): Response
    {
        $publicId = $request->routeParam('company');
        $company = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $changes = ['updated_at' => $this->clock->nowString()];

        $simple = [
            'domain' => 'domain',
            'industry' => 'industry',
            'sizeBand' => 'size_band',
            'email' => 'email',
            'phone' => 'phone',
            'website' => 'website',
            'city' => 'city',
            'state' => 'state',
            'country' => 'country',
        ];

        foreach ($simple as $key => $column) {
            if ($this->has($input, $key)) {
                $changes[$column] = $this->str($input, $key);
            }
        }

        if ($this->has($input, 'name')) {
            $name = $this->str($input, 'name');
            $duplicate = $this->companies->findByName($name);

            if ($duplicate !== null && (int) $duplicate['id'] !== (int) $company['id']) {
                throw new ConflictException('ICE-CRM-409', 'Another company already uses that name.');
            }

            $changes['name'] = $name;
            $changes['name_normalized'] = mb_strtolower($name);
        }

        if ($this->has($input, 'status')) {
            $changes['status'] = strtoupper($this->str($input, 'status'));
        }

        if ($this->has($input, 'owner')) {
            $changes['owner_user_id'] = $this->ownerId($request, $this->str($input, 'owner'));
        }

        $this->companies->update((int) $company['id'], $changes);
        $this->audit($request, 'crm_company', $publicId);

        return Response::data(['company' => $this->presenter->company($this->find($publicId))]);
    }

    /** DELETE /admin/crm/companies/{company} */
    public function destroy(Request $request): Response
    {
        $publicId = $request->routeParam('company');
        $company = $this->find($publicId);

        $this->companies->softDelete((int) $company['id']);
        $this->audit($request, 'crm_company', $publicId);

        return Response::noContent();
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->companies->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That company could not be found.');
        }

        return $row;
    }
}
