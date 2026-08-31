<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\BadRequestException;
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

/** Deals — the pipeline board and the records on it. */
final class DealController extends CrmController
{
    public function __construct(
        private readonly DealRepository $deals,
        private readonly ContactRepository $contacts,
        private readonly CompanyRepository $companies,
        private readonly ActivityRepository $activities,
        private readonly NoteRepository $notes,
        private readonly CrmPresenter $presenter,
        private readonly Clock $clock,
        Database $db,
    ) {
        parent::__construct($db);
    }

    /**
     * GET /admin/crm/deals?pipeline=sales
     *
     * The whole board: its stages, its cards already grouped into those stages,
     * and the totals. Grouping happens here rather than in the browser because
     * the empty columns have to exist either way — a stage with no deals in it is
     * still a column, and a client grouping a flat list would silently drop it.
     */
    public function board(Request $request): Response
    {
        $pipeline = $this->pipeline($request->queryString('pipeline'));
        $stages = $this->deals->stages((int) $pipeline['id']);

        $rows = $this->deals->board((int) $pipeline['id'], [
            'owner' => $request->queryString('owner', 'all'),
            'status' => $request->queryString('status', 'all'),
            'q' => $request->queryString('q'),
        ]);

        $grouped = [];

        foreach ($stages as $stage) {
            $grouped[(string) $stage['public_id']] = [];
        }

        foreach ($rows as $row) {
            $grouped[(string) $row['stage_public_id']][] = $this->presenter->deal($row);
        }

        $columns = array_map(function (array $stage) use ($grouped): array {
            $deals = $grouped[(string) $stage['public_id']] ?? [];
            $value = 0.0;

            foreach ($deals as $deal) {
                $value += (float) $deal['amountRaw'];
            }

            return [
                'stage' => $this->presenter->stage($stage),
                'deals' => $deals,
                'count' => count($deals),
                'value' => '₹' . Format::groupIndian((int) round($value)),
            ];
        }, $stages);

        return Response::data([
            'pipeline' => $this->presenter->pipeline($pipeline),
            'pipelines' => $this->presenter->map($this->deals->pipelines(), 'pipeline'),
            'columns' => $columns,
            'summary' => $this->summary((int) $pipeline['id']),
        ]);
    }

    /** GET /admin/crm/deals/{deal} */
    public function show(Request $request): Response
    {
        $deal = $this->find($request->routeParam('deal'));
        $id = (int) $deal['id'];

        return Response::data([
            'deal' => $this->presenter->deal($deal),
            'stages' => $this->presenter->map($this->deals->stages((int) $deal['pipeline_id']), 'stage'),
            'activities' => $this->presenter->map(
                $this->activities->search(['subjectType' => 'deal', 'subjectId' => $id]),
                'activity',
            ),
            'notes' => $this->presenter->map($this->notes->forSubject('deal', $id), 'note'),
        ]);
    }

    /** POST /admin/crm/deals */
    public function store(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $pipeline = $this->pipeline($this->str($input, 'pipeline'));
        $stages = $this->deals->stages((int) $pipeline['id']);

        if ($stages === []) {
            throw new BadRequestException('That pipeline has no stages, so a deal cannot be placed on it.');
        }

        $stage = $this->str($input, 'stage') === ''
            ? $stages[0]
            : $this->stage((int) $pipeline['id'], $this->str($input, 'stage'));

        $created = $this->deals->create([
            'title' => $this->str($input, 'title'),
            'pipelineId' => (int) $pipeline['id'],
            'stageId' => (int) $stage['id'],
            'contactId' => $this->contactId($this->str($input, 'contact')),
            'companyId' => $this->companyId($this->str($input, 'company')),
            'amount' => $this->amount($input),
            'currency' => 'INR',
            'source' => strtoupper($this->str($input, 'source', 'OTHER')) ?: 'OTHER',
            'probability' => $this->has($input, 'probability')
                ? max(0, min(100, $this->int($input, 'probability')))
                : (int) $stage['probability'],
            'expectedCloseOn' => $this->str($input, 'expectedCloseOn') ?: null,
            'ownerId' => $this->ownerId($request, $this->str($input, 'owner')),
        ]);

        $this->audit($request, 'crm_deal', $created['publicId']);

        return Response::data(['deal' => $this->presenter->deal($this->find($created['publicId']))], 201);
    }

    /** PATCH /admin/crm/deals/{deal} */
    public function update(Request $request): Response
    {
        $publicId = $request->routeParam('deal');
        $deal = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $changes = ['updated_at' => $this->clock->nowString()];

        if ($this->has($input, 'title')) {
            $changes['title'] = $this->str($input, 'title');
        }

        if ($this->has($input, 'amount')) {
            $changes['amount'] = $this->amount($input);
        }

        if ($this->has($input, 'probability')) {
            $changes['probability'] = max(0, min(100, $this->int($input, 'probability')));
        }

        if ($this->has($input, 'source')) {
            $changes['source'] = strtoupper($this->str($input, 'source'));
        }

        if ($this->has($input, 'expectedCloseOn')) {
            $changes['expected_close_on'] = $this->str($input, 'expectedCloseOn') ?: null;
        }

        if ($this->has($input, 'lostReason')) {
            $changes['lost_reason'] = $this->str($input, 'lostReason');
        }

        if ($this->has($input, 'contact')) {
            $changes['contact_id'] = $this->contactId($this->str($input, 'contact'));
        }

        if ($this->has($input, 'company')) {
            $changes['company_id'] = $this->companyId($this->str($input, 'company'));
        }

        if ($this->has($input, 'owner')) {
            $changes['owner_user_id'] = $this->ownerId($request, $this->str($input, 'owner'));
        }

        if ($this->has($input, 'order')) {
            $changes['order_id'] = $this->orderId($this->str($input, 'order'));
        }

        $this->deals->update((int) $deal['id'], $changes);
        $this->audit($request, 'crm_deal', $publicId);

        return Response::data(['deal' => $this->presenter->deal($this->find($publicId))]);
    }

    /**
     * POST /admin/crm/deals/{deal}/move
     *
     * A board drop. `before`/`after` are the cards the drop landed between, not
     * an index — see DealRepository::move for why that matters when two people
     * are dragging on the same board.
     */
    public function move(Request $request): Response
    {
        $publicId = $request->routeParam('deal');
        $deal = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $stage = $this->stage((int) $deal['pipeline_id'], $this->str($input, 'stage'));

        $this->deals->move(
            (int) $deal['id'],
            (int) $stage['id'],
            (string) $stage['kind'],
            $this->neighbour($this->str($input, 'before')),
            $this->neighbour($this->str($input, 'after')),
        );

        $this->audit($request, 'crm_deal', $publicId);

        return Response::data(['deal' => $this->presenter->deal($this->find($publicId))]);
    }

    /** DELETE /admin/crm/deals/{deal} */
    public function destroy(Request $request): Response
    {
        $publicId = $request->routeParam('deal');
        $deal = $this->find($publicId);

        $this->deals->softDelete((int) $deal['id']);
        $this->audit($request, 'crm_deal', $publicId);

        return Response::noContent();
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->deals->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That deal could not be found.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function pipeline(string $slug): array
    {
        $row = $slug === '' ? $this->deals->defaultPipeline() : $this->deals->findPipeline($slug);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That pipeline could not be found.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function stage(int $pipelineId, string $slug): array
    {
        $row = $this->deals->findStage($pipelineId, $slug);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That stage is not part of this pipeline.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function summary(int $pipelineId): array
    {
        $row = $this->deals->summary($pipelineId);
        $won = (int) ($row['won_count'] ?? 0);
        $lost = (int) ($row['lost_count'] ?? 0);
        $settled = $won + $lost;

        return [
            'total' => (int) ($row['total'] ?? 0),
            'openCount' => (int) ($row['open_count'] ?? 0),
            'openValue' => '₹' . Format::groupIndian((int) round((float) ($row['open_value'] ?? 0))),
            'weightedValue' => '₹' . Format::groupIndian((int) round((float) ($row['weighted_value'] ?? 0))),
            'wonCount' => $won,
            'wonValue' => '₹' . Format::groupIndian((int) round((float) ($row['won_value'] ?? 0))),
            'lostCount' => $lost,
            'lostValue' => '₹' . Format::groupIndian((int) round((float) ($row['lost_value'] ?? 0))),
            /* Of the deals that have actually SETTLED — an open pipeline must not
               drag the win rate down just by being open. Null, not 0, when
               nothing has settled yet: 0% and "no data" look identical on a tile
               and mean opposite things. */
            'winRate' => $settled === 0 ? null : (int) round($won / $settled * 100),
        ];
    }

    /** @param array<string, mixed> $input */
    private function amount(array $input): string
    {
        $value = $input['amount'] ?? 0;

        return number_format(max(0, (float) (is_numeric($value) ? $value : 0)), 2, '.', '');
    }

    private function neighbour(string $publicId): ?int
    {
        if ($publicId === '') {
            return null;
        }

        $row = $this->deals->find($publicId);

        return $row === null ? null : (int) $row['id'];
    }

    private function contactId(string $publicId): ?int
    {
        if ($publicId === '' || $publicId === 'none') {
            return null;
        }

        $row = $this->contacts->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That contact could not be found.');
        }

        return (int) $row['id'];
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

    /** Links a won deal to the order it became — by number or by public id. */
    private function orderId(string $reference): ?int
    {
        if ($reference === '' || $reference === 'none') {
            return null;
        }

        $row = $this->db->selectOne(
            'SELECT id FROM orders WHERE number = ? OR public_id = ? LIMIT 1',
            [$reference, $reference],
        );

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That order could not be found.');
        }

        return (int) $row['id'];
    }
}
