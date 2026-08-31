"use client";

import { Loader2, Ticket, Wallet } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

import { AccountSection } from "@/components/account/account-section";
import { formatPrice } from "@/features/02-products/utils/format-price";
import { RedeemVoucherDialog } from "@/features/10-coupons/components/redeem-voucher-dialog";
import { formatDay, isClaimed, voucherPurpose, type Voucher } from "@/features/10-coupons/vouchers";
import { useVouchers } from "@/features/10-coupons/vouchers-context";
import { useWallet } from "@/features/21-wallet/wallet-context";

/**
 * The vouchers tab — the register, now that the WALLET is where credit lives.
 *
 * A voucher used to be spent at checkout, and that was the bug: it was consumed
 * whole by whatever order it was typed into, so ₹4,600 of credit spent on a
 * ₹1,200 order destroyed ₹3,400. It now pours into the balance instead, where
 * it is spent to the rupee over as many orders as it takes.
 *
 * So this page keeps two jobs and loses one. It still says where each piece of
 * credit came from — which return, which piece, what it was worth — and it
 * still offers the ones not yet added. What it no longer does is hand out a
 * code to paste into a coupon box, because there is nothing to paste it into:
 * `Add to wallet` moves the money and the balance does the rest.
 *
 * `Added` is the state that used to be `Claimed`. Same column, same underlying
 * `claimedOn` — a voucher is still one-use — but the honest name for where it
 * went is the wallet, not an order.
 */
export function AccountVouchers() {
  const { vouchers, balance, claim } = useVouchers();
  const { wallet, redeem } = useWallet();
  const [redeeming, setRedeeming] = useState<Voucher | null>(null);
  /** The code currently being moved into the wallet, if any. */
  const [adding, setAdding] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const active = vouchers.filter((voucher) => !isClaimed(voucher));

  /**
   * Move one voucher into the balance.
   *
   * The local record is marked added only AFTER the server agrees, and with the
   * same `claim` the register has always used — so the row, the rail count and
   * the wallet all move together without a reload, and a refusal leaves the
   * voucher exactly as it was.
   */
  async function addToWallet(voucher: Voucher) {
    if (adding) return;

    setProblem(null);
    setAdding(voucher.code);

    const failure = await redeem(voucher.code);

    setAdding(null);
    if (failure) {
      setProblem(failure);
      return;
    }

    claim(voucher.code, "Wallet");
  }

  return (
    <AccountSection
      copy="When a return is settled we issue store credit rather than sending money back to a card. Add a voucher to your wallet and its value sits there until you spend it — to the rupee, over as many orders as it takes."
      eyebrow="Account / Store credit"
      title="Your vouchers."
    >
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <Wallet aria-hidden size={16} strokeWidth={1.6} />
              {formatPrice(balance)} still to add
            </h3>
            <p className="io-panel__note">
              {active.length === 0
                ? `Everything has been added. Your wallet holds ${formatPrice(wallet.balance)}.`
                : `Across ${active.length} voucher${active.length === 1 ? "" : "s"}. Your wallet already holds ${formatPrice(wallet.balance)}.`}
            </p>
          </div>
          <Link className="io-btn io-btn--ghost io-btn--sm" href="/account/wallet">
            <Wallet aria-hidden size={14} strokeWidth={1.7} />
            Open wallet
          </Link>
        </header>

        {problem && (
          <p className="io-formerror" role="alert">
            {problem}
          </p>
        )}

        {vouchers.length === 0 ? (
          <div className="io-empty">
            <strong>No vouchers yet</strong>
Store credit turns up here the moment one of your returns is settled — and lands
            straight in your wallet.
          </div>
        ) : (
          <div className="io-tablewrap">
            <table className="io-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">What it is for</th>
                  <th data-align="right" scope="col">
                    Worth
                  </th>
                  <th scope="col">Status</th>
                  <th data-align="right" scope="col">
                    <span className="sr-only">Redeem</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => {
                  const claimed = isClaimed(voucher);
                  const purpose = voucherPurpose(voucher);

                  return (
                    <tr key={voucher.code}>
                      <th scope="row">
                        <span className="io-table__primary">{voucher.code}</span>
                        <span className="io-table__sub">
                          {claimed
                            ? `Added ${formatDay(voucher.claimedOn)}`
                            : `Add before ${formatDay(voucher.expiresOn)}`}
                        </span>
                      </th>
                      <td>
                        <span className="io-table__primary">{purpose.title}</span>
                        {/* Where it came from — or, once it is gone, where it
                            went, which is the more useful of the two by then.
                            Blank when that would just repeat the line above. */}
                        {(claimed && voucher.claimedOrder) || purpose.note ? (
                          <span className="io-table__sub">
                            {claimed && voucher.claimedOrder
                              ? voucher.claimedOrder === "Wallet"
                                ? "Added to your wallet"
                                : `Spent on ${voucher.claimedOrder}`
                              : purpose.note}
                          </span>
                        ) : null}
                      </td>
                      <td className="io-table__num" data-align="right">
                        <span className="io-table__primary">{formatPrice(voucher.amount)}</span>
                      </td>
                      <td>
                        <span className={`io-badge ${claimed ? "" : "io-badge--ok"}`}>
                          {claimed ? "Added" : "Ready"}
                        </span>
                      </td>
                      <td data-align="right">
                        <button
                          className={`io-btn io-btn--sm ${claimed ? "io-btn--ghost" : "io-btn--solid"}`}
                          disabled={adding !== null}
                          onClick={() =>
                            claimed ? setRedeeming(voucher) : void addToWallet(voucher)
                          }
                          type="button"
                        >
                          {adding === voucher.code ? (
                            <Loader2 aria-hidden className="wa-spin" size={14} strokeWidth={1.8} />
                          ) : null}
                          {claimed ? "View" : adding === voucher.code ? "Adding" : "Add to wallet"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="io-note">
        <Ticket aria-hidden size={16} strokeWidth={1.7} />
        <p>
          <strong>A voucher is added once, then spent as money</strong>
          Adding one moves its full value into your wallet, where it comes off your orders a
          rupee at a time — a small order no longer swallows the rest of it. It works
          alongside a discount code rather than instead of one.
        </p>
      </div>

      {/* Keyed on the code so opening a second voucher gets a fresh dialog
          rather than one still showing the first one's "Copied". */}
      <RedeemVoucherDialog
        key={redeeming?.code ?? "none"}
        onOpenChange={(open) => !open && setRedeeming(null)}
        voucher={redeeming}
      />
    </AccountSection>
  );
}
