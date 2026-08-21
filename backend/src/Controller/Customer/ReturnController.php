<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\ReturnPresenter;
use Iced\Repository\ReturnRepository;
use Iced\Repository\UserRepository;

/**
 * The customer's own half of returns.
 *
 * `ReturnRepository::forUser` and `ReturnPresenter::customerRow` were both
 * already written and neither had a route: the customer's returns screens read a
 * fixture file instead, so a return an operator approved in the console was
 * invisible to the person who raised it, and the wizard that raised one wrote
 * nothing anywhere.
 *
 *   GET  /me/returns   this shopper's returns, and the vocabularies the wizard needs
 *   POST /me/returns   raise one against something they bought
 *
 * A raised return is always `New` — the repository's `insert` hardcodes it. What
 * happens next is the moderation desk's, exactly as with a review.
 */
final class ReturnController
{
    public function __construct(
        private readonly ReturnRepository $returns,
        private readonly ReturnPresenter $presenter,
        private readonly UserRepository $users,
        private readonly Database $db,
    ) {
    }

    /**
     * GET /me/returns
     *
     * The returns, plus the two vocabularies the wizard offers — the reasons and
     * the outcomes. Both are settings the console owns, so they travel with the
     * list rather than being written out again in the browser: a reason added in
     * settings appears in the wizard without a deploy, and the wizard cannot
     * offer one the server would refuse.
     */
    public function index(Request $request): Response
    {
        $principal = $this->principal($request);

        return Response::data([
            'returns' => $this->presenter->customerRows($this->returns->forUser($principal->userId)),
            'reasons' => $this->returns->reasons(),
            'outcomes' => $this->returns->outcomes(),
        ]);
    }

    /**
     * POST /me/returns
     *
     * The item has to be one this shopper actually bought, on an order that is
     * actually theirs. Checked here rather than trusted from the body: without it
     * anybody could raise a return against any order number and any amount, and
     * the amount is what a voucher would eventually be worth.
     */
    public function create(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{order: string, item: string, reason: string, outcome: string, replacement?: string, pickup?: string} $input */
        $input = $request->validated();

        $account = $this->users->findById($principal->userId);

        return $this->db->transaction(function () use ($input, $principal, $account): Response {
            /* The order, and it must belong to the caller. A 404 rather than a 403
               for an order that is somebody else's: whether a given order number
               exists is not this shopper's business either. */
            $order = $this->db->selectOne(
                'SELECT id, number FROM orders WHERE number = ? AND user_id = ? LIMIT 1',
                [$input['order'], $principal->userId],
            );

            if ($order === null) {
                throw new NotFoundException('ICE-RET-404', 'We could not find that order on your account.');
            }

            /* The line, and its price — which is what the return is worth. Taking
               the amount from the request would let a shopper name their own
               refund. */
            $line = $this->db->selectOne(
                'SELECT oi.id, oi.name, oi.size, oi.unit_price
                   FROM order_items oi
                  WHERE oi.order_id = ? AND CONCAT(oi.name, \' · \', oi.size) = ?
                  LIMIT 1',
                [(int) $order['id'], $input['item']],
            );

            if ($line === null) {
                throw ValidationException::field('item', 'That item is not on this order.', 'ICE-RET-422');
            }

            $this->assertVocabulary('reason', $input['reason'], $this->returns->reasons());
            $this->assertVocabulary('outcome', $input['outcome'], $this->returns->outcomes());

            $exchange = $input['outcome'] === 'Exchange';
            $replacementLabel = $exchange ? (string) ($input['replacement'] ?? '') : '';

            if ($exchange && $replacementLabel === '') {
                throw ValidationException::field('replacement', 'Say what you would like instead.', 'ICE-RET-422');
            }

            /* The replacement is named as "Product · Size"; only the product half
               identifies a catalogue row, and only a PUBLISHED one can be
               promised. */
            $replacementId = null;

            if ($exchange) {
                $name = trim(explode('·', $replacementLabel)[0] ?? '');
                $product = $this->db->selectOne(
                    "SELECT id FROM products
                      WHERE name = ? AND deleted_at IS NULL AND status = 'Published' LIMIT 1",
                    [$name],
                );

                if ($product === null) {
                    throw ValidationException::field(
                        'replacement',
                        'That replacement is not available any more.',
                        'ICE-RET-422',
                    );
                }

                $replacementId = (int) $product['id'];
            }

            $publicId = $this->returns->nextPublicId();

            $this->returns->insert(
                $publicId,
                (string) $order['number'],
                $principal->userId,
                $account === null ? 'A customer' : (string) $account['name'],
                sprintf('%s · %s', (string) $line['name'], (string) $line['size']),
                (int) $line['id'],
                $input['reason'],
                $input['outcome'],
                Money::fromDecimalString((string) $line['unit_price'])->toDecimalString(),
                $replacementId,
                $replacementLabel,
                $exchange ? 'Replacement item' : 'Store credit balance',
                (string) ($input['pickup'] ?? ''),
            );

            $row = $this->returns->find($publicId);

            return Response::data($row === null ? [] : $this->presenter->customerRow($row), 201);
        });
    }

    /**
     * @param list<string> $allowed
     *
     * @throws ValidationException
     */
    private function assertVocabulary(string $field, string $value, array $allowed): void
    {
        if (!in_array($value, $allowed, true)) {
            throw ValidationException::field(
                $field,
                sprintf('Choose one of: %s.', implode(', ', $allowed)),
                'ICE-RET-422',
            );
        }
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
