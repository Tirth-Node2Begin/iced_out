<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\Format;
use Iced\Presenter\ReviewPresenter;
use Iced\Repository\ReviewRepository;
use Iced\Support\Clock;

/** Spec §8.27 — console reviews (4 endpoints), permission `reviews.moderate`. */
final class ReviewController
{
    public function __construct(
        private readonly ReviewRepository $reviews,
        private readonly ReviewPresenter $presenter,
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** #159 GET /admin/reviews */
    public function index(Request $request): Response
    {
        return Response::data($this->presenter->rows($this->reviews->search([
            'status' => $request->queryString('status'),
            'product' => $request->queryString('product'),
            'q' => $request->queryString('q'),
        ])));
    }

    /**
     * #160 POST /admin/reviews/{id}/hide — takes it off the storefront.
     *
     * This replaces `approve`/`reject`. A review is published when it arrives,
     * so there is nothing to approve; what the desk needs is a way to take one
     * DOWN, and to put it back when the reason turns out not to hold. Both still
     * write a `review_moderation_history` row, which is what makes the decision
     * answerable later.
     */
    public function hide(Request $request): Response
    {
        return $this->moderate($request, 'Hidden');
    }

    /**
     * #161 POST /admin/reviews/{id}/publish — puts a hidden one back.
     *
     * Named `publish` rather than `show` because the endpoint file for a route
     * ending at `{id}` is already `show.php` (`EndpointScaffolder::fileFor`), so
     * an action called `show` would land in the same file as the detail verbs
     * and quietly take PATCH and DELETE off the air.
     */
    public function publish(Request $request): Response
    {
        return $this->moderate($request, 'Published');
    }

    /**
     * #164 DELETE /admin/reviews/{id} — removes it outright.
     *
     * Distinct from hiding, and the distinction is the whole point: hiding is
     * reversible and leaves the record and its history in place, which is what
     * a policy breach calls for. This is for a row that should not exist —
     * spam, a test, an erasure request — and it takes the moderation trail with
     * it because a history of decisions about a review that is gone is not an
     * audit trail, it is a residue.
     *
     * The product's rating summary is recomputed, since the average it was part
     * of is no longer true.
     */
    public function destroy(Request $request): Response
    {
        $id = $request->routeParam('id');
        $review = $this->reviews->find($id);

        if ($review === null) {
            throw new NotFoundException('ICE-RVW-404', 'We could not find that review.');
        }

        return $this->db->transaction(function () use ($review, $id, $request): Response {
            $request->setAttribute('audit_entity_type', 'review');
            $request->setAttribute('audit_entity_id', $id);
            $request->setAttribute('audit_before', $this->presenter->row($review));

            $this->reviews->delete((int) $review['id']);
            $this->reviews->refreshRatingSummary(
                $review['product_id'] === null ? null : (int) $review['product_id'],
            );

            return Response::noContent();
        });
    }

    /** #162 POST /admin/reviews — a console-origin review. */
    public function create(Request $request): Response
    {
        /** @var array{product: string, rating: int, customer: string, headline: string, body?: string} $input */
        $input = $request->validated();

        $product = $this->db->selectOne(
            'SELECT id, name FROM products WHERE public_id = ? OR name = ? LIMIT 1',
            [$input['product'], $input['product']],
        );

        $publicId = $this->reviews->nextPublicId();

        $this->reviews->insert(
            $publicId,
            $product === null ? $input['product'] : (string) $product['name'],
            $product === null ? null : (int) $product['id'],
            $input['rating'],
            $input['customer'],
            null,
            $input['headline'],
            (string) ($input['body'] ?? ''),
            null,
            Format::longDate($this->clock->now()),
            'Console',
            null,
        );

        $request->setAttribute('audit_entity_type', 'review');
        $request->setAttribute('audit_entity_id', $publicId);

        $row = $this->reviews->find($publicId);

        return Response::data($row === null ? [] : $this->presenter->row($row), 201);
    }

    /**
     * #163 PATCH /admin/reviews/{id} — corrects what a review records.
     *
     * Separate from the two moderation verbs on purpose. Approving and rejecting
     * are DECISIONS: they write a `review_moderation_history` row and they
     * recompute the product's rating summary. This is a CORRECTION, and the two
     * must not be the same endpoint — a desk that could publish a review by
     * editing it would publish reviews nobody decided on.
     *
     * `status` is therefore not editable here. It is moved by its own verb.
     *
     * The rating IS editable, and changing it re-runs the product's summary,
     * because the average on the storefront is derived from these numbers and a
     * correction that left it stale would make the two disagree.
     */
    public function update(Request $request): Response
    {
        $id = $request->routeParam('id');
        $review = $this->reviews->find($id);

        if ($review === null) {
            throw new NotFoundException('ICE-RVW-404', 'We could not find that review.');
        }

        /** @var array<string, mixed> $input */
        $input = $request->validated();

        return $this->db->transaction(function () use ($review, $id, $input, $request): Response {
            $request->setAttribute('audit_entity_type', 'review');
            $request->setAttribute('audit_entity_id', $id);
            $request->setAttribute('audit_before', $this->presenter->row($review));

            $fields = [];

            foreach ([
                'customer' => 'customer_name',
                'headline' => 'headline',
                'body' => 'body',
                'fit' => 'fit',
            ] as $key => $column) {
                if (array_key_exists($key, $input)) {
                    $fields[$column] = $input[$key];
                }
            }

            $rated = array_key_exists('rating', $input)
                && (int) $input['rating'] !== (int) $review['rating'];

            if ($rated) {
                $fields['rating'] = (int) $input['rating'];
            }

            /* Re-pointing a review at a different product is deliberately not
               offered. What a review is about is the one thing its author
               decided, and moving it would carry their words onto a piece they
               never bought — and past the one-per-customer key on the way. */
            $this->reviews->update($id, $fields);

            if ($rated) {
                $this->reviews->refreshRatingSummary(
                    $review['product_id'] === null ? null : (int) $review['product_id'],
                );
            }

            $row = $this->reviews->find($id);
            $presented = $row === null ? [] : $this->presenter->row($row);
            $request->setAttribute('audit_after', $presented);

            return Response::data($presented);
        });
    }

    private function moderate(Request $request, string $status): Response
    {
        $id = $request->routeParam('id');
        $review = $this->reviews->find($id);

        if ($review === null) {
            throw new NotFoundException('ICE-RVW-404', 'We could not find that review.');
        }

        return $this->db->transaction(function () use ($review, $status, $id, $request): Response {
            $from = (string) $review['status'];

            if ($from !== $status) {
                $this->reviews->setStatus((int) $review['id'], $status);
                $this->reviews->appendModeration((int) $review['id'], $from, $status, $this->actorId($request));
                $this->reviews->refreshRatingSummary($review['product_id'] === null ? null : (int) $review['product_id']);
            }

            $request->setAttribute('audit_entity_type', 'review');
            $request->setAttribute('audit_entity_id', $id);

            $row = $this->reviews->find($id);

            return Response::data($row === null ? [] : $this->presenter->row($row));
        });
    }

    private function actorId(Request $request): ?int
    {
        $principal = $request->attribute('principal');

        return $principal instanceof Principal ? $principal->userId : null;
    }
}
