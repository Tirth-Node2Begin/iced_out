<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\WalletPresenter;
use Iced\Service\Wallet\WalletService;
use Iced\Support\Clock;

/**
 * The shopper's own wallet.
 *
 * Two verbs, and the asymmetry is the design: money comes OUT of a wallet only
 * at checkout, inside the place-order transaction, where it can be weighed
 * against an order that is being created in the same breath. There is no
 * "spend" endpoint here, because a debit that is not attached to an order is a
 * way to lose money with nothing to show for it.
 *
 * What money goes IN is: a settled return (the console does that), and a
 * voucher the shopper pours in themselves — which is what `redeem` is.
 */
final class WalletController
{
    public function __construct(
        private readonly WalletService $wallet,
        private readonly WalletPresenter $presenter,
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** GET /me/wallet — the balance, and how it got that way. */
    public function show(Request $request): Response
    {
        $principal = $this->principal($request);
        $statement = $this->wallet->statement($principal->userId);

        return Response::data([
            'balance' => $this->wallet->balance($principal->userId)->rupees(),
            'currency' => 'INR',
            'entries' => $this->presenter->entries($statement),
            'totals' => $this->presenter->totals($statement),
            /* Vouchers still sitting outside the wallet, so the page can offer
               them rather than making the shopper remember a code. */
            'pending' => $this->pendingVouchers($principal->userId),
        ]);
    }

    /**
     * POST /me/wallet/redeem — a voucher code, into the balance.
     *
     * This is the one place a voucher is spent now, and it is spent INTO the
     * wallet rather than against an order. That is the whole fix for the bug
     * this feature exists to close: a ₹4,600 voucher used to be consumed whole
     * by whatever order it was typed into, so a ₹1,200 order destroyed ₹3,400
     * of somebody's money. Poured into a balance it keeps its value until it is
     * actually spent, however many orders that takes.
     */
    public function redeem(Request $request): Response
    {
        $principal = $this->principal($request);

        /** @var array{code: string} $input */
        $input = $request->validated();
        $code = strtoupper(trim($input['code']));

        return $this->db->transaction(function () use ($principal, $code): Response {
            /* Locked, because the check below and the claim after it must not
               have a second request in between. Two tabs redeeming the same
               code would otherwise both see it unclaimed and both credit. */
            $voucher = $this->db->selectOne(
                'SELECT * FROM vouchers WHERE code = ? LIMIT 1 FOR UPDATE',
                [$code],
            );

            if ($voucher === null) {
                throw ValidationException::field('code', sprintf('%s is not a code we know.', $code), 'ICE-CPN-422');
            }

            $owner = $voucher['customer_user_id'] === null ? null : (int) $voucher['customer_user_id'];

            /* A voucher issued TO someone is theirs alone. One issued with no
               account behind it — the console could not match the name typed —
               is a bearer code: whoever holds it may add it, once. */
            if ($owner !== null && $owner !== $principal->userId) {
                throw ValidationException::field('code', sprintf('%s is not on your account.', $code), 'ICE-CPN-422');
            }

            if (($voucher['claimed_on'] ?? null) !== null) {
                throw new ConflictException('ICE-CPN-409', sprintf('%s has already been added.', $code));
            }

            $today = $this->clock->display($this->clock->now())->format('Y-m-d');

            if ((string) $voucher['expires_on'] < $today) {
                throw new ConflictException(
                    'ICE-CPN-409',
                    sprintf('%s expired on %s.', $code, (string) $voucher['expires_on']),
                );
            }

            $amount = Money::fromDecimalString((string) $voucher['amount']);

            $entry = $this->wallet->credit(
                $principal->userId,
                $amount,
                WalletService::KIND_VOUCHER,
                $code,
                (string) $voucher['reason'] !== '' ? (string) $voucher['reason'] : 'Voucher added to your wallet.',
            );

            $this->db->statement(
                'UPDATE vouchers
                    SET claimed_on = ?, claimed_order = ?, customer_user_id = ?, wallet_entry_id = ?, updated_at = ?
                  WHERE id = ?',
                [
                    $today,
                    // Where it went, in the same field that used to name the
                    // order that ate it. "Wallet" is now the honest answer.
                    'Wallet',
                    $principal->userId,
                    $entry === null ? null : (int) $entry['id'],
                    $this->clock->nowString(),
                    (int) $voucher['id'],
                ],
            );

            return Response::data([
                'added' => $amount->rupees(),
                'balance' => $this->wallet->balance($principal->userId)->rupees(),
                'entry' => $entry === null ? null : $this->presenter->entry($entry),
            ], 201);
        });
    }

    /**
     * Vouchers on this account that have not been poured in yet.
     *
     * Expired ones are left out: the wallet page offers these as one-press
     * actions, and offering a button that can only fail is worse than not
     * offering it. The vouchers tab still lists them as the record they are.
     *
     * @return list<array<string, mixed>>
     */
    private function pendingVouchers(int $userId): array
    {
        $rows = $this->db->select(
            'SELECT code, amount, reason, expires_on FROM vouchers
              WHERE customer_user_id = ? AND claimed_on IS NULL AND expires_on >= ?
              ORDER BY expires_on',
            [$userId, $this->clock->display($this->clock->now())->format('Y-m-d')],
        );

        return array_map(static fn (array $row): array => [
            'code' => (string) $row['code'],
            'amount' => Money::fromDecimalString((string) $row['amount'])->rupees(),
            'reason' => (string) $row['reason'],
            'expiresOn' => (string) $row['expires_on'],
        ], $rows);
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
