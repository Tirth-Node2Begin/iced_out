<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CrmPresenter;
use Iced\Repository\Crm\CompanyRepository;
use Iced\Repository\Crm\ContactRepository;
use Iced\Repository\Crm\DealRepository;
use Iced\Repository\Crm\LeadRepository;
use Iced\Support\Clock;

/** Leads — inbound interest, and the one screen where it stops being anonymous. */
final class LeadController extends CrmController
{
    public function __construct(
        private readonly LeadRepository $leads,
        private readonly ContactRepository $contacts,
        private readonly CompanyRepository $companies,
        private readonly DealRepository $deals,
        private readonly CrmPresenter $presenter,
        private readonly Clock $clock,
        Database $db,
    ) {
        parent::__construct($db);
    }

    /** GET /admin/crm/leads */
    public function index(Request $request): Response
    {
        $rows = $this->leads->search([
            'status' => $request->queryString('status', 'all'),
            'source' => $request->queryString('source', 'all'),
            'owner' => $request->queryString('owner', 'all'),
            'q' => $request->queryString('q'),
        ]);

        return Response::data([
            'leads' => $this->presenter->map($rows, 'lead'),
            'counts' => (object) $this->leads->statusCounts(),
        ]);
    }

    /** GET /admin/crm/leads/{lead} */
    public function show(Request $request): Response
    {
        return Response::data(['lead' => $this->presenter->lead($this->find($request->routeParam('lead')))]);
    }

    /** POST /admin/crm/leads */
    public function store(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $publicId = $this->leads->create([
            'name' => $this->str($input, 'name'),
            'email' => $this->str($input, 'email'),
            'phone' => $this->str($input, 'phone'),
            'company' => $this->str($input, 'company'),
            'source' => strtoupper($this->str($input, 'source', 'WEBSITE')) ?: 'WEBSITE',
            'status' => strtoupper($this->str($input, 'status', 'NEW')) ?: 'NEW',
            'score' => max(0, min(100, $this->int($input, 'score'))),
            'message' => $this->str($input, 'message'),
            'ownerId' => $this->ownerId($request, $this->str($input, 'owner')),
        ]);

        $this->audit($request, 'crm_lead', $publicId);

        return Response::data(['lead' => $this->presenter->lead($this->find($publicId))], 201);
    }

    /** PATCH /admin/crm/leads/{lead} */
    public function update(Request $request): Response
    {
        $publicId = $request->routeParam('lead');
        $lead = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $changes = ['updated_at' => $this->clock->nowString()];

        foreach (['name' => 'name', 'phone' => 'phone', 'company' => 'company_name', 'message' => 'message'] as $key => $column) {
            if ($this->has($input, $key)) {
                $changes[$column] = $this->str($input, $key);
            }
        }

        if ($this->has($input, 'email')) {
            $email = $this->str($input, 'email');
            $changes['email'] = $email;
            $changes['email_normalized'] = mb_strtolower($email);
        }

        foreach (['source', 'status'] as $key) {
            if ($this->has($input, $key)) {
                $changes[$key] = strtoupper($this->str($input, $key));
            }
        }

        if ($this->has($input, 'score')) {
            $changes['score'] = max(0, min(100, $this->int($input, 'score')));
        }

        if ($this->has($input, 'lostReason')) {
            $changes['lost_reason'] = $this->str($input, 'lostReason');
        }

        if ($this->has($input, 'owner')) {
            $changes['owner_user_id'] = $this->ownerId($request, $this->str($input, 'owner'));
        }

        /* CONVERTED is written by convert() alone — a plain edit setting it would
           leave a lead marked converted with nothing to show for it.

           The route's `in:` rule already excludes CONVERTED, so in practice the
           request is refused at the boundary with a 422 and this never fires.
           It stays as the backstop for the day someone widens that rule. */
        if (($changes['status'] ?? '') === 'CONVERTED') {
            throw new ConflictException('ICE-CRM-409', 'Use the convert action to turn a lead into a contact.');
        }

        $this->leads->update((int) $lead['id'], $changes);
        $this->audit($request, 'crm_lead', $publicId);

        return Response::data(['lead' => $this->presenter->lead($this->find($publicId))]);
    }

    /**
     * POST /admin/crm/leads/{lead}/convert
     *
     * The one action in the module that writes to three tables. A lead becomes a
     * contact always, a company when it named one, and a deal when the operator
     * asked for one — all inside a transaction, because a lead marked CONVERTED
     * with no contact behind it is worse than a lead nobody touched.
     *
     * An existing contact with the same email is REUSED rather than duplicated:
     * the same person filling the form twice is the normal case, not an error.
     */
    public function convert(Request $request): Response
    {
        $publicId = $request->routeParam('lead');
        $lead = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        if ((string) $lead['status'] === 'CONVERTED') {
            throw new ConflictException('ICE-CRM-409', 'This lead has already been converted.');
        }

        return $this->db->transaction(function () use ($lead, $publicId, $input, $request): Response {
            $ownerId = $this->has($input, 'owner')
                ? $this->ownerId($request, $this->str($input, 'owner'))
                : ($lead['owner_user_id'] === null ? null : (int) $lead['owner_user_id']);

            $companyId = null;
            $companyName = $this->str($input, 'company', (string) $lead['company_name']);

            if ($companyName !== '') {
                $existing = $this->companies->findByName($companyName);
                $companyId = $existing !== null
                    ? (int) $existing['id']
                    : $this->companies->create([
                        'name' => $companyName,
                        'domain' => '',
                        'industry' => '',
                        'sizeBand' => '',
                        'email' => '',
                        'phone' => '',
                        'website' => '',
                        'city' => '',
                        'state' => '',
                        'country' => 'India',
                        'ownerId' => $ownerId,
                    ])['id'];
            }

            $contactRow = $this->contacts->findByEmail((string) $lead['email']);

            if ($contactRow !== null) {
                $contactId = (int) $contactRow['id'];
                $this->contacts->update($contactId, [
                    'lifecycle' => 'QUALIFIED',
                    'company_id' => $companyId ?? ($contactRow['company_id'] === null ? null : (int) $contactRow['company_id']),
                    'updated_at' => $this->clock->nowString(),
                ]);
            } else {
                [$first, $last] = $this->splitName((string) $lead['name']);

                $contactId = $this->contacts->create([
                    'firstName' => $first,
                    'lastName' => $last,
                    'email' => (string) $lead['email'],
                    'phone' => (string) $lead['phone'],
                    'jobTitle' => '',
                    'lifecycle' => 'QUALIFIED',
                    'source' => (string) $lead['source'],
                    'city' => '',
                    'state' => '',
                    'country' => 'India',
                    'companyId' => $companyId,
                    /* Not linked to a storefront account here: matching a lead to
                       a shopper by email alone would silently hand one person's
                       order history to another with the same address. The contact
                       screen offers the link as a deliberate action. */
                    'userId' => null,
                    'ownerId' => $ownerId,
                ])['id'];
            }

            $dealId = null;

            if ($this->bool($input, 'createDeal', true)) {
                $pipeline = $this->deals->defaultPipeline();

                if ($pipeline === null) {
                    throw new ConflictException('ICE-CRM-409', 'No pipeline is configured, so this lead cannot open a deal.');
                }

                $stages = $this->deals->stages((int) $pipeline['id']);
                $firstStage = $stages[0] ?? null;

                if ($firstStage === null) {
                    throw new ConflictException('ICE-CRM-409', 'The default pipeline has no stages, so this lead cannot open a deal.');
                }

                $dealId = $this->deals->create([
                    'title' => $this->str($input, 'dealTitle', (string) $lead['name']),
                    'pipelineId' => (int) $pipeline['id'],
                    'stageId' => (int) $firstStage['id'],
                    'contactId' => $contactId,
                    'companyId' => $companyId,
                    'amount' => number_format((float) ($input['dealAmount'] ?? 0), 2, '.', ''),
                    'currency' => 'INR',
                    'source' => (string) $lead['source'],
                    'probability' => (int) $firstStage['probability'],
                    'expectedCloseOn' => $this->str($input, 'expectedCloseOn') ?: null,
                    'ownerId' => $ownerId,
                ])['id'];
            }

            $this->leads->markConverted((int) $lead['id'], $contactId, $dealId);
            $this->audit($request, 'crm_lead', $publicId);

            return Response::data(['lead' => $this->presenter->lead($this->find($publicId))]);
        });
    }

    /** DELETE /admin/crm/leads/{lead} */
    public function destroy(Request $request): Response
    {
        $publicId = $request->routeParam('lead');
        $lead = $this->find($publicId);

        $this->leads->softDelete((int) $lead['id']);
        $this->audit($request, 'crm_lead', $publicId);

        return Response::noContent();
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->leads->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That lead could not be found.');
        }

        return $row;
    }

    /**
     * "Aarav Kapoor" → ["Aarav", "Kapoor"]; "Aarav" → ["Aarav", ""].
     * Everything after the first space is the surname, so "Van Der Berg" stays
     * intact rather than losing its middle.
     *
     * @return array{0: string, 1: string}
     */
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
