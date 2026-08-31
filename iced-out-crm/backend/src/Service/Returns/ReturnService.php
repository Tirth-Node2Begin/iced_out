<?php

declare(strict_types=1);

namespace Iced\Service\Returns;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Presenter\ReturnPresenter;
use Iced\Repository\ReturnRepository;
use Iced\Service\Wallet\WalletService;
use Iced\Support\Clock;

/**
 * The return machine of spec §9.5:
 *
 *   New → Awaiting payment   (exchange where the replacement costs more)
 *   New → Approved | Rejected
 *   Awaiting payment → Approved            (difference collected)
 *   Approved → Completed                   (settle)
 *
 * Settling is where money moves, and it moves into the WALLET.
 *
 * A Voucher return still mints its voucher — the register is the document
 * trail, and `ret-072 → IOV072` is still traceable both ways — but the voucher
 * is born already poured in: credited to the customer's wallet and marked
 * claimed against it in the same transaction. Two reasons, and both were bugs:
 *
 *   · a voucher spent at checkout was consumed WHOLE, so ₹4,600 of credit used
 *     on a ₹1,200 order destroyed ₹3,400 of a customer's money;
 *   · it rode in the coupon slot, so taking it meant giving up any promotion.
 *
 * A balance has neither problem. It is spent to the rupee, over as many orders
 * as it takes, alongside whatever else the shopper has.
 *
 * An EXCHANGE into something cheaper credits the difference the same way. That
 * figure was already computed and already quoted to the customer in as many
 * words — `ReturnPresenter::balance()` returns `direction: 'credit'` — and
 * before this it was never paid out to anybody.
 *
 * All of it is IDEMPOTENT twice over: a unique index on `return_public_id` for
 * the voucher, and one on `(kind, reference)` for the wallet entry. Settling the
 * same return twice credits once.
 */
final class ReturnService
{
    public function __construct(
        private readonly Database $db,
        private readonly ReturnRepository $returns,
        private readonly ReturnPresenter $presenter,
        private readonly WalletService $wallet,
        private readonly Clock $clock,
    ) {
    }

    /** @return array<string, mixed> */
    public function find(string $publicId): array
    {
        $row = $this->returns->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-RET-404', 'We could not find that return.');
        }

        return $row;
    }

    /** #134 approve */
    public function approve(string $publicId, Principal $actor): array
    {
        return $this->db->transaction(function () use ($publicId, $actor): array {
            $return = $this->find($publicId);
            $state = (string) $return['state'];

            if ($state === 'Approved') {
                return $return;
            }

            if (!in_array($state, ['New', 'Awaiting payment'], true)) {
                throw new ConflictException(
                    'ICE-RET-409',
                    sprintf('A return that is %s cannot be approved.', strtolower($state)),
                );
            }

            $balance = $this->presenter->balance($return);

            if ($balance['direction'] === 'collect') {
                if ($state === 'New') {
                    // Raising the payment request IS the approval step here.
                    $this->returns->setState((int) $return['id'], 'Awaiting payment', 'Pickup scheduled');
                    $this->returns->appendHistory(
                        (int) $return['id'],
                        $state,
                        'Awaiting payment',
                        $actor->userId,
                        sprintf('₹%d to collect before the swap.', $balance['amount']),
                    );

                    return $this->find($publicId);
                }

                throw new ConflictException(
                    'ICE-RET-422',
                    sprintf('Collect the ₹%d difference before approving this exchange.', $balance['amount']),
                );
            }

            $this->returns->setState((int) $return['id'], 'Approved', 'Pickup scheduled');
            $this->returns->appendHistory((int) $return['id'], $state, 'Approved', $actor->userId, 'Approved in the console');

            return $this->find($publicId);
        });
    }

    /** #135 reject */
    public function reject(string $publicId, Principal $actor): array
    {
        return $this->db->transaction(function () use ($publicId, $actor): array {
            $return = $this->find($publicId);

            if ((string) $return['state'] !== 'New') {
                throw new ConflictException('ICE-RET-409', 'Only a new request can be rejected.');
            }

            $this->returns->setState((int) $return['id'], 'Rejected', 'Pickup scheduled');
            $this->returns->appendHistory((int) $return['id'], 'New', 'Rejected', $actor->userId, 'Rejected in the console');

            return $this->find($publicId);
        });
    }

    /** #136 collect-payment — Awaiting payment → Approved. */
    public function collectPayment(string $publicId, Principal $actor): array
    {
        return $this->db->transaction(function () use ($publicId, $actor): array {
            $return = $this->find($publicId);

            if ((string) $return['state'] !== 'Awaiting payment') {
                throw new ConflictException('ICE-RET-409', 'That return is not waiting on a payment.');
            }

            $balance = $this->presenter->balance($return);

            $this->returns->setState((int) $return['id'], 'Approved', 'Pickup scheduled');
            $this->returns->appendHistory(
                (int) $return['id'],
                'Awaiting payment',
                'Approved',
                $actor->userId,
                sprintf('₹%d difference collected.', $balance['amount']),
            );

            return $this->find($publicId);
        });
    }

    /** #137 settle — Approved → Completed, issuing the voucher idempotently. */
    public function settle(string $publicId, Principal $actor): array
    {
        return $this->db->transaction(function () use ($publicId, $actor): array {
            $return = $this->find($publicId);

            if ((string) $return['state'] === 'Completed') {
                return $return;
            }

            if ((string) $return['state'] !== 'Approved') {
                throw new ConflictException('ICE-RET-409', 'Approve the return before settling it.');
            }

            $isVoucher = (string) $return['outcome'] === 'Voucher';

            $credited = $isVoucher
                ? $this->creditReturn($return)
                : $this->creditExchangeDifference($return);

            $this->returns->setState(
                (int) $return['id'],
                'Completed',
                $isVoucher ? 'Credited to wallet' : 'Exchange on its way',
            );

            $this->returns->appendHistory(
                (int) $return['id'],
                'Approved',
                'Completed',
                $actor->userId,
                /* The history line names the FIGURE, not just the act. "Voucher
                   issued" told an operator nothing they could check against a
                   customer's screen; "₹4,600 credited to the wallet" is the
                   same sentence the customer's statement shows. */
                $credited === null
                    ? ($isVoucher ? 'Credit issued' : 'Replacement dispatched')
                    : sprintf(
                        '₹%s credited to the wallet.%s',
                        number_format(Money::fromDecimalString((string) $credited['amount'])->rupees()),
                        $isVoucher ? '' : ' The replacement costs less than the piece returned.',
                    ),
            );

            return $this->find($publicId);
        });
    }

    /**
     * #67 the customer raising one. The amount comes from the order line, never
     * from the request body — a customer does not price their own refund.
     *
     * @param array<string, mixed> $orderLine
     */
    public function open(
        array $order,
        array $orderLine,
        string $reason,
        string $outcome,
        ?string $replacementSlug,
        string $pickupSlot,
        ?int $userId,
    ): array {
        return $this->db->transaction(function () use ($order, $orderLine, $reason, $outcome, $replacementSlug, $pickupSlot, $userId): array {
            if (!(bool) $orderLine['return_eligible']) {
                throw new ConflictException('ICE-RET-409', 'That piece is not eligible for a return.');
            }

            // Both vocabularies are settings the store owns, so they are checked
            // here rather than pinned in the schema.
            $reasons = $this->returns->reasons();

            if (!in_array($reason, $reasons, true)) {
                throw ValidationException::field(
                    'reason',
                    sprintf('Choose one of: %s.', implode(', ', $reasons)),
                    'ICE-RET-422',
                );
            }

            $outcomes = $this->returns->outcomes();

            if (!in_array($outcome, $outcomes, true)) {
                throw ValidationException::field(
                    'outcome',
                    sprintf('Choose one of: %s.', implode(', ', $outcomes)),
                    'ICE-RET-422',
                );
            }

            $replacement = null;

            if ($outcome === 'Exchange') {
                if ($replacementSlug === null || $replacementSlug === '') {
                    throw ValidationException::field('replacement', 'Choose what to swap it for.', 'ICE-RET-422');
                }

                $replacement = $this->db->selectOne(
                    "SELECT id, name FROM products WHERE public_id = ? AND deleted_at IS NULL AND status = 'Published'",
                    [$replacementSlug],
                );

                if ($replacement === null) {
                    throw ValidationException::field('replacement', 'That replacement is not available.', 'ICE-RET-422');
                }
            }

            $publicId = $this->returns->nextPublicId();

            $this->returns->insert(
                $publicId,
                (string) $order['number'],
                $userId,
                (string) $order['contact_name'],
                sprintf('%s · %s', $orderLine['name'], $orderLine['size']),
                (int) $orderLine['id'],
                $reason,
                $outcome,
                (string) $orderLine['line_total'],
                $replacement === null ? null : (int) $replacement['id'],
                $replacement === null ? '' : sprintf('%s · %s', $replacement['name'], $orderLine['size']),
                sprintf('%s %s', $order['addr_city'], $order['addr_postal']),
                $pickupSlot,
            );

            return $this->find($publicId);
        });
    }

    /**
     * A settled Voucher return: the voucher row, and the credit it becomes.
     *
     * The voucher is still minted, because the register is the paper trail an
     * operator reconciles against and `ret-072 → IOV072` reads both ways. What
     * changed is that it is born SPENT — claimed against the wallet in the same
     * transaction — so there is exactly one live copy of the money and no way
     * for the customer to be credited twice for one return.
     *
     * A return raised by a guest has no account to credit. The voucher is still
     * issued and stays unclaimed, so it can be added to a wallet later by
     * whoever the store gives the code to.
     *
     * @param array<string, mixed> $return
     *
     * @return array<string, mixed>|null the wallet entry, when there was an
     *         account to credit
     */
    private function creditReturn(array $return): ?array
    {
        $code = $this->voucherFor($return);
        $userId = $return['user_id'] === null ? null : (int) $return['user_id'];
        $amount = Money::fromDecimalString((string) $return['amount']);

        if ($userId === null) {
            return null;
        }

        $entry = $this->wallet->credit(
            $userId,
            $amount,
            WalletService::KIND_RETURN,
            (string) $return['public_id'],
            sprintf('Credit for %s.', (string) $return['item_label']),
        );

        $this->db->statement(
            'UPDATE vouchers
                SET claimed_on = ?, claimed_order = ?, wallet_entry_id = ?, updated_at = ?
              WHERE code = ? AND claimed_on IS NULL',
            [
                $this->clock->display($this->clock->now())->format('Y-m-d'),
                'Wallet',
                $entry === null ? null : (int) $entry['id'],
                $this->clock->nowString(),
                $code,
            ],
        );

        return $entry;
    }

    /**
     * The other half of an exchange: a swap into something CHEAPER.
     *
     * `ReturnPresenter::balance()` has always computed this, the wizard has
     * always quoted it to the customer — "₹800 comes back to you as store
     * credit" — and until the wallet existed there was nowhere to put it, so
     * nobody was ever paid. A swap into something dearer is the other
     * direction and is collected before approval, which is why nothing is
     * credited here for it.
     *
     * @param array<string, mixed> $return
     *
     * @return array<string, mixed>|null
     */
    private function creditExchangeDifference(array $return): ?array
    {
        $balance = $this->presenter->balance($return);
        $userId = $return['user_id'] === null ? null : (int) $return['user_id'];

        if ($userId === null || $balance['direction'] !== 'credit' || $balance['amount'] <= 0) {
            return null;
        }

        return $this->wallet->credit(
            $userId,
            Money::fromRupees($balance['amount']),
            WalletService::KIND_EXCHANGE,
            (string) $return['public_id'],
            sprintf('The swap into %s cost less.', (string) $return['replacement_label']),
        );
    }

    /**
     * `ret-072` → `IOV072`, stepping over a code already taken. The unique index
     * on return_public_id is what actually makes this idempotent — this method
     * checking first is a courtesy, the constraint is the guarantee.
     *
     * @param array<string, mixed> $return
     *
     * @return string the code, whether it was just minted or already existed
     */
    private function voucherFor(array $return): string
    {
        $existing = $this->db->selectOne(
            'SELECT code FROM vouchers WHERE return_public_id = ? LIMIT 1',
            [(string) $return['public_id']],
        );

        if ($existing !== null) {
            return (string) $existing['code'];
        }

        $digits = str_pad((string) preg_replace('/\D/', '', (string) $return['public_id']), 3, '0', STR_PAD_LEFT);
        $base = 'IOV' . $digits;
        $code = $base;
        $suffix = 1;

        while ($this->db->selectOne('SELECT id FROM vouchers WHERE code = ?', [$code]) !== null) {
            ++$suffix;
            $code = sprintf('%s-%d', $base, $suffix);
        }

        $today = $this->clock->display($this->clock->now());

        $this->db->statement(
            'INSERT INTO vouchers
                (code, amount, return_public_id, reason, customer_name, customer_user_id, issued_on, expires_on)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $code,
                Money::fromDecimalString((string) $return['amount'])->toDecimalString(),
                (string) $return['public_id'],
                (string) $return['item_label'],
                (string) $return['customer_name'],
                $return['user_id'] === null ? null : (int) $return['user_id'],
                $today->format('Y-m-d'),
                $today->modify('+1 year')->format('Y-m-d'),
            ],
        );

        return $code;
    }
}
