<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\Format;
use Iced\Presenter\ReviewPresenter;
use Iced\Presenter\SupportPresenter;
use Iced\Repository\ReviewRepository;
use Iced\Repository\SupportRepository;
use Iced\Repository\UserRepository;
use Iced\Support\Clock;

/**
 * The customer's own half of reviews and support.
 *
 * These were missing entirely, which is why both features lived in
 * `localStorage`: there was nowhere for a shopper to send a review or a question,
 * so the storefront wrote one into the browser and the console read it back out
 * of the same browser. Two tabs on one machine agreed with each other and with
 * nothing else — a review "approved" on the moderation desk was approved for
 * exactly one person, and a support query nobody at the shop could ever see.
 *
 * Four endpoints close both loops:
 *
 *   GET  /reviews?product=      the approved reviews, public — what a PDP quotes
 *   POST /me/reviews            a shopper writes one; it is live at once
 *   GET  /me/reviews            their own, whatever state each is in
 *   POST /support/queries       a shopper asks something
 *   GET  /me/support            their own threads, with any reply
 *
 * A submitted review is `Published` on arrival. The desk takes one down rather
 * than letting it up — see migration 0022. What follows is the old note, kept
 * because the reasoning about the byline still holds:
 *
 * A submitted review used to be `Pending`. Publishing was a decision taken on the
 * moderation desk, not a consequence of having written something — that rule was
 * already in the repository's `insert`, which hardcodes the status.
 */
final class FeedbackController
{
    public function __construct(
        private readonly ReviewRepository $reviews,
        private readonly ReviewPresenter $reviewPresenter,
        private readonly SupportRepository $support,
        private readonly SupportPresenter $supportPresenter,
        private readonly UserRepository $users,
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * GET /reviews — the approved reviews, for the storefront.
     *
     * `?product=<slug>` narrows to one product's; without it this is every
     * approved review, which is what the home page's testimonial band reads.
     *
     * Only `Approved`, and that is not a filter the caller can widen: a pending
     * review is one nobody has agreed to publish, and a public endpoint that
     * could be asked for them would publish them.
     */
    public function reviews(Request $request): Response
    {
        $rows = $this->reviews->search([
            /* Everything the desk has not taken down. A review is live from the
               moment it is written — see migration 0022. */
            'status' => 'Published',
            'product' => $request->queryString('product'),
        ]);

        return Response::data($this->reviewPresenter->rows($rows));
    }

    /** GET /me/reviews — the signed-in shopper's own, in every state. */
    public function myReviews(Request $request): Response
    {
        $principal = $this->principal($request);

        $rows = $this->db->select(
            'SELECT r.*, p.public_id AS product_slug FROM reviews r
               LEFT JOIN products p ON p.id = r.product_id
              WHERE r.user_id = ? ORDER BY r.created_at DESC, r.id DESC',
            [$principal->userId],
        );

        return Response::data($this->reviewPresenter->rows($rows));
    }

    /**
     * POST /me/reviews — a shopper writes one.
     *
     * The customer's name comes from their ACCOUNT, never from the request: a
     * review is attributed, and letting the body carry the byline would let
     * anybody sign one with somebody else's name.
     */
    public function submitReview(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{product: string, rating: int, headline: string, body?: string, fit?: string} $input */
        $input = $request->validated();

        $account = $this->users->findById($principal->userId);

        return $this->db->transaction(function () use ($input, $principal, $account): Response {
            /* Matched on slug or name, the same way the console's own create does,
               so a review can be left against a product whichever the caller has. */
            $product = $this->db->selectOne(
                'SELECT id, name FROM products WHERE public_id = ? OR name = ? LIMIT 1',
                [$input['product'], $input['product']],
            );

            /* One customer, one product, one opinion.

               The database enforces it too (`uq_reviews_customer_product`), and
               that is the constraint that actually holds under two requests
               arriving at once. This is here so the common case is a sentence
               the shopper can act on rather than a duplicate-key error — and so
               it can say what state their existing review is in, which is
               usually what they are really asking. */
            if ($product !== null) {
                $existing = $this->reviews->findByCustomerAndProduct(
                    $principal->userId,
                    (int) $product['id'],
                );

                if ($existing !== null) {
                    throw new ConflictException(
                        'ICE-REV-409',
                        $this->alreadyReviewed((string) $existing['status'], (string) $product['name']),
                    );
                }
            }

            $publicId = $this->reviews->nextPublicId();

            $this->reviews->insert(
                $publicId,
                $product === null ? $input['product'] : (string) $product['name'],
                $product === null ? null : (int) $product['id'],
                $input['rating'],
                $account === null ? 'A customer' : (string) $account['name'],
                $principal->userId,
                $input['headline'],
                (string) ($input['body'] ?? ''),
                ($input['fit'] ?? '') === '' ? null : (string) $input['fit'],
                Format::longDate($this->clock->now()),
                'Customer',
                null,
            );

            $row = $this->reviews->find($publicId);

            return Response::data($row === null ? [] : $this->reviewPresenter->row($row), 201);
        });
    }

    /**
     * Why a second review was refused, in the words that answer the question
     * behind it — which is almost always "where did mine go".
     */
    private function alreadyReviewed(string $status, string $product): string
    {
        return match ($status) {
            'Hidden' => sprintf(
                'You have already reviewed %s. That review was taken down, and each customer may leave one review per piece.',
                $product,
            ),
            default => sprintf('You have already reviewed %s. It is on the product page.', $product),
        };
    }

    /**
     * POST /support/queries — a shopper asks something.
     *
     * Customer audience rather than public: a query carries an email and a name,
     * and an unauthenticated endpoint that files them is a mailbox anyone can
     * fill. The contact details come from the account for the same reason the
     * review's byline does.
     */
    public function submitQuery(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{topic: string, message: string, order?: string} $input */
        $input = $request->validated();

        $account = $this->users->findById($principal->userId);

        return $this->db->transaction(function () use ($input, $principal, $account): Response {
            $reference = $this->support->nextReference();

            $this->support->insert(
                $reference,
                $account === null ? 'A customer' : (string) $account['name'],
                $account === null ? '' : (string) $account['email'],
                $principal->userId,
                $input['topic'],
                (string) ($input['order'] ?? ''),
                $input['message'],
                Format::sentAt($this->clock->now()),
            );

            $row = $this->support->find($reference);

            return Response::data($row === null ? [] : $this->supportPresenter->row($row), 201);
        });
    }

    /**
     * GET /me/support — the shopper's own threads, and the topics they may pick.
     *
     * The topics ride along because they are a settings vocabulary the console
     * owns: a topic added there has to appear in the shopper's dropdown without a
     * deploy, and both sides reading `SupportRepository::topics` is what keeps the
     * form from offering one the server would refuse.
     */
    public function myQueries(Request $request): Response
    {
        $principal = $this->principal($request);
        $account = $this->users->findById($principal->userId);

        $rows = $this->support->forUser(
            $principal->userId,
            $account === null ? '' : (string) $account['email'],
        );

        return Response::data([
            'queries' => $this->supportPresenter->rows($rows),
            'topics' => $this->support->topics(),
        ]);
    }

    private function principal(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException();
        }

        return $principal;
    }
}
