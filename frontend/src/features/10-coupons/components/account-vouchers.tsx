"use client";

import { Ticket, Wallet } from "lucide-react";
import { useState } from "react";

import { AccountSection } from "@/components/account/account-section";
import { formatPrice } from "@/features/02-products/utils/format-price";
import { RedeemVoucherDialog } from "@/features/10-coupons/components/redeem-voucher-dialog";
import { formatDay, isClaimed, voucherPurpose, type Voucher } from "@/features/10-coupons/vouchers";
import { useVouchers } from "@/features/10-coupons/vouchers-context";

/**
 * The vouchers tab.
 *
 * A return does not send money back to a card — it issues store credit, and
 * this is where that credit lives. Every row does one thing: open the code so
 * it can be copied and pasted at checkout.
 *
 * Nothing on this page spends a voucher. Copying is not redeeming, so the
 * status stays `Active` however many times a code is copied, and turns
 * `Claimed` only when an order is actually placed with it — after which it is
 * gone from the bag's table entirely and cannot be used again.
 */
export function AccountVouchers() {
  const { vouchers, balance } = useVouchers();
  const [redeeming, setRedeeming] = useState<Voucher | null>(null);

  const active = vouchers.filter((voucher) => !isClaimed(voucher));

  return (
    <AccountSection
      copy="When a return is settled we issue store credit rather than sending money back to a card. Each voucher is good for one order — redeem the code at checkout whenever you like."
      eyebrow="Account / Store credit"
      title="Your vouchers."
    >
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <Wallet aria-hidden size={16} strokeWidth={1.6} />
              {formatPrice(balance)} to redeem
            </h3>
            <p className="io-panel__note">
              {active.length === 0
                ? "Nothing left to redeem right now."
                : `Across ${active.length} voucher${active.length === 1 ? "" : "s"}.`}
            </p>
          </div>
        </header>

        {vouchers.length === 0 ? (
          <div className="io-empty">
            <strong>No vouchers yet</strong>
            Store credit turns up here the moment one of your returns is settled.
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
                            ? `Redeemed ${formatDay(voucher.claimedOn)}`
                            : `Redeem before ${formatDay(voucher.expiresOn)}`}
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
                              ? `Redeemed on ${voucher.claimedOrder}`
                              : purpose.note}
                          </span>
                        ) : null}
                      </td>
                      <td className="io-table__num" data-align="right">
                        <span className="io-table__primary">{formatPrice(voucher.amount)}</span>
                      </td>
                      <td>
                        <span className={`io-badge ${claimed ? "" : "io-badge--ok"}`}>
                          {claimed ? "Claimed" : "Active"}
                        </span>
                      </td>
                      <td data-align="right">
                        <button
                          className={`io-btn io-btn--sm ${claimed ? "io-btn--ghost" : "io-btn--solid"}`}
                          onClick={() => setRedeeming(voucher)}
                          type="button"
                        >
                          {claimed ? "View" : "Redeem"}
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
          <strong>One voucher, one order</strong>
          Copying a code does not use it up — it stays active until you place an order with it.
          After that it is claimed, and the whole value came off that one order.
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
