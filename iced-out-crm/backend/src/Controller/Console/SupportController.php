<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\SupportPresenter;
use Iced\Repository\SupportRepository;

/** Spec §8.28 — console support (4 endpoints), permission `support.tickets.manage`. */
final class SupportController
{
    public function __construct(
        private readonly SupportRepository $support,
        private readonly SupportPresenter $presenter,
        private readonly Database $db,
    ) {
    }

    /** #163 GET /admin/support/queries?status=open|resolved|all */
    public function index(Request $request): Response
    {
        return Response::data($this->presenter->rows($this->support->search([
            'status' => $request->queryString('status', 'all'),
            'q' => $request->queryString('q'),
        ])));
    }

    /** #164 GET /admin/support/queries/{reference} */
    public function show(Request $request): Response
    {
        return Response::data($this->presenter->row($this->find($request->routeParam('reference'))));
    }

    /** #165 POST /admin/support/queries/{reference}/resolve — answering IS resolving. */
    public function resolve(Request $request): Response
    {
        $reference = $request->routeParam('reference');
        $query = $this->find($reference);
        /** @var array{reply: string} $input */
        $input = $request->validated();

        return $this->db->transaction(function () use ($reference, $query, $input, $request): Response {
            $this->support->resolve((int) $query['id'], $input['reply'], $this->actorId($request));
            $this->support->appendHistory((int) $query['id'], (string) $query['status'], 'Resolved', $this->actorId($request));

            $request->setAttribute('audit_entity_type', 'support_query');
            $request->setAttribute('audit_entity_id', $reference);

            return Response::data($this->presenter->row($this->find($reference)));
        });
    }

    /** #166 POST /admin/support/queries/{reference}/reopen — the reply is preserved. */
    public function reopen(Request $request): Response
    {
        $reference = $request->routeParam('reference');
        $query = $this->find($reference);

        return $this->db->transaction(function () use ($reference, $query, $request): Response {
            $this->support->reopen((int) $query['id']);
            $this->support->appendHistory((int) $query['id'], (string) $query['status'], 'Open', $this->actorId($request));

            $request->setAttribute('audit_entity_type', 'support_query');
            $request->setAttribute('audit_entity_id', $reference);

            return Response::data($this->presenter->row($this->find($reference)));
        });
    }

    /** @return array<string, mixed> */
    private function find(string $reference): array
    {
        $row = $this->support->find($reference);

        if ($row === null) {
            throw new NotFoundException('ICE-SUP-404', 'We could not find that query.');
        }

        return $row;
    }

    private function actorId(Request $request): ?int
    {
        $principal = $request->attribute('principal');

        return $principal instanceof Principal ? $principal->userId : null;
    }
}
