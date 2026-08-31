<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CrmPresenter;
use Iced\Repository\Crm\ActivityRepository;
use Iced\Repository\Crm\NoteRepository;

/** Notes — the sentence about a record that no column has a place for. */
final class NoteController extends CrmController
{
    public function __construct(
        private readonly NoteRepository $notes,
        private readonly ActivityRepository $activities,
        private readonly CrmPresenter $presenter,
        Database $db,
    ) {
        parent::__construct($db);
    }

    /** GET /admin/crm/notes?about=contact&aboutId=cnt-0004 */
    public function index(Request $request): Response
    {
        $type = $request->queryString('about');
        $id = $this->subject($type, $request->queryString('aboutId'));

        return Response::data(['notes' => $this->presenter->map($this->notes->forSubject($type, $id), 'note')]);
    }

    /** POST /admin/crm/notes */
    public function store(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $type = $this->str($input, 'aboutType');
        $id = $this->subject($type, $this->str($input, 'aboutId'));

        $publicId = $this->notes->create(
            $type,
            $id,
            $this->str($input, 'body'),
            $this->bool($input, 'pinned'),
            $this->actorId($request),
        );

        $this->audit($request, 'crm_note', $publicId);

        return Response::data(['note' => $this->presenter->note($this->find($publicId))], 201);
    }

    /** PATCH /admin/crm/notes/{note} */
    public function update(Request $request): Response
    {
        $publicId = $request->routeParam('note');
        $note = $this->find($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $this->notes->update(
            (int) $note['id'],
            $this->has($input, 'body') ? $this->str($input, 'body') : (string) $note['body'],
            $this->has($input, 'pinned') ? $this->bool($input, 'pinned') : (int) $note['pinned'] === 1,
        );

        $this->audit($request, 'crm_note', $publicId);

        return Response::data(['note' => $this->presenter->note($this->find($publicId))]);
    }

    /** DELETE /admin/crm/notes/{note} */
    public function destroy(Request $request): Response
    {
        $publicId = $request->routeParam('note');
        $note = $this->find($publicId);

        $this->notes->softDelete((int) $note['id']);
        $this->audit($request, 'crm_note', $publicId);

        return Response::noContent();
    }

    /** @return array<string, mixed> */
    private function find(string $publicId): array
    {
        $row = $this->notes->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That note could not be found.');
        }

        return $row;
    }

    private function subject(string $type, string $publicId): int
    {
        $id = $this->activities->resolveSubject($type, $publicId);

        if ($id === null) {
            throw new NotFoundException('ICE-CRM-404', 'The record this note belongs to could not be found.');
        }

        return $id;
    }
}
