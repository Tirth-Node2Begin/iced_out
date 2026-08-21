<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CustomerOrderPresenter;
use Iced\Presenter\VoucherPresenter;
use Iced\Repository\OrderRepository;
use Iced\Repository\VoucherRepository;

/**
 * Spec §8.10 the shopper's own orders, and §8.13 their vouchers.
 *
 * Every read here is scoped to the signed-in account. An order that belongs to
 * somebody else is a 404, not a 403 — confirming it exists would already be
 * telling a stranger something about it.
 */
final class OrderController
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly CustomerOrderPresenter $presenter,
        private readonly VoucherRepository $vouchers,
        private readonly VoucherPresenter $voucherPresenter,
        private readonly Database $db,
    ) {
    }

    /** #59 GET /me/orders — newest first. */
    public function index(Request $request): Response
    {
        $principal = $this->principal($request);

        return Response::data(array_map(
            fn (array $order): array => $this->hydrate($order),
            $this->orders->forCustomer($principal->userId),
        ));
    }

    /** #60 GET /me/orders/{idOrNumber} — by public id or by order number. */
    public function show(Request $request): Response
    {
        $principal = $this->principal($request);
        $key = $request->routeParam('id');

        $order = $this->db->selectOne(
            'SELECT * FROM orders WHERE (public_id = ? OR number = ?) AND user_id = ? LIMIT 1',
            [$key, $key, $principal->userId],
        );

        if ($order === null) {
            throw new NotFoundException('ICE-ORD-404', 'We could not find that order.');
        }

        return Response::data($this->hydrate($order));
    }

    /** #70 GET /me/vouchers — what is held, what it is worth, what the bag accepts. */
    public function vouchers(Request $request): Response
    {
        $principal = $this->principal($request);
        $held = $this->vouchers->forUser($principal->userId);

        $balance = 0;
        $redeemable = [];

        foreach ($held as $voucher) {
            if (($voucher['claimed_on'] ?? null) !== null) {
                continue;
            }

            // An expired voucher is still a record, but the bag will not take it.
            if ((string) $voucher['expires_on'] < date('Y-m-d')) {
                continue;
            }

            $coupon = $this->voucherPresenter->asCoupon($voucher);
            $redeemable[] = $coupon;
            $balance += (int) $coupon['value'];
        }

        return Response::data([
            'vouchers' => array_map(fn (array $row): array => $this->voucherPresenter->row($row), $held),
            'balance' => $balance,
            'redeemable' => $redeemable,
        ]);
    }

    /**
     * @param array<string, mixed> $order
     *
     * @return array<string, mixed>
     */
    private function hydrate(array $order): array
    {
        $orderId = (int) $order['id'];

        return $this->presenter->record(
            $order,
            $this->orders->lines($orderId),
            $this->orders->latestPayment($orderId),
            $this->db->selectOne(
                "SELECT * FROM shipments WHERE order_id = ? AND status <> 'Cancelled' ORDER BY id DESC LIMIT 1",
                [$orderId],
            ),
        );
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
