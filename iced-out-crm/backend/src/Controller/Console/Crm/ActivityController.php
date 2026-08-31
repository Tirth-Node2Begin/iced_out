<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\BadRequestException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CrmPresenter;
use Iced\Repository\Crm\ActivityRepository;
use Iced\Repository\Crm\ContactRepository;
use Iced\Repository\Crm\DealRepository;
use Iced\Repository\Crm\LeadRepository;
use Iced\Support\Clock;

/** Tasks, calls and meetings — the work waiting, and the work that happened. */
final class ActivityController extends CrmController
{
    public function __construct(
        private readonly ActivityRepository $activities,
        private readonly LeadRepository $leads,
        private readonly ContactRepository $contacts,
        private readonly DealRepository $deals,
        private readonly CrmPresenter $presenter,
        private readonly Clock $clock,
        Database $db,
    ) {
        parent::__construct($db);
    }

    /** GET /admin/crm/activities?scope=today|overdue|upcoming|open|done */
    public function index(Request $request): Response
    {
        $subjectType = $request->queryString('about');
        $subjectId = null;

        if ($subjectType !== '') {
            $subjectId = $this->activities->resolveSubject($subjectType, $request->queryString('aboutId'));

            if ($subjectId === null) {
                throw new NotFoundException('ICE-CRM-404', 'That record could not be found.');
            }
        }

        $rows = $this->activities->search([
            'scope' => $request->queryString('scope', 'open'),
            'type' => $request->queryString('type', 'all'),
            'owner' => $request->queryString('owner', 'all'),
            'subjectType' => $subjectType,
            'subjectId' => $subjectId,
            'q' => $request->queryString('q'),
        ]);

        return Response::data([
            'activities' => $this->presenter->map($rows, 'activity'),
            'counts' => $this->activities->counts($this->scopeOwner($request)),
        ]);
    }

    /** POST /admin/crm/activities */
    public function store(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $subjectType = $this->str($input, 'aboutType');
        $subjectId = $this->activities->resolveSubject($subjectType, $this->str($input, 'aboutId'));

        if ($subjectId === null) {
            throw new NotFoundException('ICE-CRM-404', 'The record this task is about could not be found.');
        }

        $publicId = $this->activities->create([
            'type' => strtoupper($this->str($input, 'type', 'TASK')) ?: 'TASK',
            'subject' => $this->str($input, 'subject'),
            'body' => $this->str($input, 'body'),
            'subjectType' => $subjectType,
            'subjectId' => $subjectId,
            'dueAt' => $this->dueAt($this->str($input, 'dueAt')),
            'priority' => strtoupper($this->str($input, 'priority', 'NORMAL')) ?: 'NORMAL',
            /* Unowned work is work nobody does. An activity created without an
               explicit owner belongs to whoever created it. */
            'ownerId' => $this->has($input, 'owner')
                ? $this->ownerId($request, $this->str($input, 'owner'))
                : $this->actorId($request),
            'createdBy' => $this->actorId($request),
        ]);

        $this->touchSubject($subjectType, $subjectId);
        $this->audit($request, 'crm_activity', $publicId);

        return Response::data(['activity' => $this->presenter->activity($this->find($publicId))], 201);
    }

    /** PATCH /admin/crm/activities/{activity} */
    public function update(Request $request): Response
    {
        $publicId = $request->routeParam('activity');
        $activity = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $changes = ['updated_at' => $this->clock->nowString()];

        if ($this->has($input, 'subject')) {
            $changes['subject'] = $this->str($input, 'subject');
        }

        if ($this->has($input, 'body')) {
            $changes['body'] = $this->str($input, 'body');
        }

        foreach (['type', 'priority'] as $key) {
            if ($this->has($input, $key)) {
                $changes[$key] = strtoupper($this->str($input, $key));
            }
        }

        if ($this->has($input, 'dueAt')) {
            $changes['due_at'] = $this->dueAt($this->str($input, 'dueAt'));
        }

        if ($this->has($input, 'owner')) {
            $changes['owner_user_id'] = $this->ownerId($request, $this->str($input, 'owner'));
        }

        $this->activities->update((int) $activity['id'], $changes);
        $this->audit($request, 'crm_activity', $publicId);

        return Response::data(['activity' => $this->presenter->activity($this->find($publicId))]);
    }

    /** POST /admin/crm/activities/{activity}/complete */
    public function complete(Request $request): Response
    {
        $publicId = $request->routeParam('activity');
        $activity = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $this->activities->complete((int) $activity['id'], $this->str($input, 'outcome'));
        $this->touchSubject((string) $activity['subject_type'], (int) $activity['subject_id']);
        $this->audit($request, 'crm_activity', $publicId);

        return Response::data(['activity' => $this->presenter->activity($this->find($publicId))]);
    }

    /** POST /admin/crm/activities/{activity}/reopen */
    public function reopen(Request $request): Response
    {
        $publicId = $request->routeParam('activity');
        $activity = $this->find($publicId);

        $this->activities->reopen((int) $activity['id']);
        $this->audit($request, 'crm_activity', $publicId);

        return Response::data(['activity' => $this->presenter->activity($this->find($publicId))]);
    }

    /** DELETE /admin/crm/activities/{activity} */
    public function destroy(Request $request): Response
    {
        $publicId = $request->routeParam('activity');
        $activity = $this->find($publicId);

        $this->activities->softDelete((int) $activity['id']);
        $this->audit($request, 'crm_activity', $publicId);

        return Response::noContent();
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->activities->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That task could not be found.');
        }

        return $row;
    }

    /**
     * The counts beside the tabs answer for whoever the list is filtered to. An
     * operator looking at their own queue must not see the whole team's overdue
     * count sitting above it.
     */
    private function scopeOwner(Request $request): ?int
    {
        $owner = $request->queryString('owner', 'all');

        if ($owner === 'me') {
            return $this->actorId($request);
        }

        if ($owner === '' || $owner === 'all' || $owner === 'unassigned') {
            return null;
        }

        $row = $this->db->selectOne(
            'SELECT id FROM users WHERE public_id = ? AND type = ? AND deleted_at IS NULL LIMIT 1',
            [$owner, 'STAFF'],
        );

        return $row === null ? null : (int) $row['id'];
    }

    /**
     * `2026-08-30T14:30` from a datetime-local input into the storage format.
     * A blank string clears the due date rather than failing — "no longer
     * scheduled" is a legitimate edit.
     */
    private function dueAt(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        $normalized = str_replace('T', ' ', $value);
        $timestamp = strtotime($normalized . ' UTC');

        if ($timestamp === false) {
            throw new BadRequestException('That due date could not be read.');
        }

        return gmdate('Y-m-d H:i:s', $timestamp) . '.000000';
    }

    /**
     * Logging work against a record is the record's most recent activity. The
     * lists sort on this, so without it a contact you called yesterday sinks
     * below one nobody has touched in a year.
     */
    private function touchSubject(string $type, int $id): void
    {
        match ($type) {
            'lead' => $this->leads->touchActivity($id),
            'contact' => $this->contacts->touchActivity($id),
            'deal' => $this->deals->touchActivity($id),
            default => null,
        };
    }
}
