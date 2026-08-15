"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Ticket, X } from "lucide-react";
import { useEffect, useState } from "react";

import { formatPrice } from "@/features/02-products/utils/format-price";
import { formatDay, isClaimed, voucherPurpose, type Voucher } from "@/features/10-coupons/vouchers";

/**
 * Redeeming a voucher: the code, big enough to read, and one button to take it.
 *
 * The dialog does NOT apply anything. Copying is not spending, and a code sat
 * on the clipboard is still an active voucher — so the status here says
 * `Active` right up until an order is actually placed with it, and only then
 * does it read `Claimed`. Telling somebody their credit was used the moment
 * they copied it would be a lie the checkout would then contradict.
 */
export function RedeemVoucherDialog({
  voucher,
  onOpenChange,
}: {
  /** The voucher being redeemed, or null when nothing is open. */
  voucher: Voucher | null;
  onOpenChange: (open: boolean) => void;
}) {
  /* Reset between vouchers by the key the caller passes, not by an effect —
     the dialog is remounted per code, so it can never open still saying
     "Copied" from the last one. */
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!voucher) return null;

  const claimed = isClaimed(voucher);

  async function copy() {
    if (!voucher) return;
    try {
      await navigator.clipboard.writeText(voucher.code);
      setCopied(true);
    } catch {
      /* Some browsers refuse the clipboard outright. The code is on screen at
         the size it is precisely so this is a shrug rather than a dead end. */
      setCopied(false);
    }
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open>
      <Dialog.Portal>
        <Dialog.Overlay className="io-modal__overlay" />
        <Dialog.Content className="io-modal">
          <div className="io-modal__head">
            <div>
              <Dialog.Title className="io-modal__title">
                {claimed ? "Already redeemed" : "Redeem this voucher"}
              </Dialog.Title>
              <Dialog.Description className="io-modal__note">
                {claimed
                  ? `Spent on order ${voucher.claimedOrder || "one of yours"} on ${formatDay(voucher.claimedOn)}. A voucher is good for one order only.`
                  : "Copy the code and paste it into the coupon box at checkout. Copying does not use it up — it stays active until you place an order."}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="io-modal__close">
              <X aria-hidden size={18} />
            </Dialog.Close>
          </div>

          <div className="io-modal__body">
            <div className="io-voucher">
              <p className="io-voucher__label">
                <Ticket aria-hidden size={13} strokeWidth={1.7} />
                Voucher code
              </p>
              <strong className="io-voucher__code">{voucher.code}</strong>
              <p className="io-voucher__worth">{formatPrice(voucher.amount)}</p>
              <span
                className={`io-badge ${claimed ? "" : "io-badge--ok"} io-voucher__state`}
              >
                {claimed ? "Claimed" : "Active"}
              </span>
            </div>

            <dl className="io-voucher__facts">
              <div>
                <dt>What it is for</dt>
                <dd>{voucherPurpose(voucher).title}</dd>
              </div>
              <div>
                <dt>Issued</dt>
                <dd>{formatDay(voucher.issuedOn)}</dd>
              </div>
              <div>
                <dt>{claimed ? "Redeemed" : "Redeem before"}</dt>
                <dd>{formatDay(claimed ? voucher.claimedOn : voucher.expiresOn)}</dd>
              </div>
            </dl>

            {!claimed && (
              <p className="io-voucher__rule">
                It is a one-time code, so spend it in a single order — the whole value comes off
                that order, up to whatever the order is worth.
              </p>
            )}
          </div>

          <div className="io-modal__foot">
            <Dialog.Close className="io-btn io-btn--ghost">Close</Dialog.Close>
            <button
              className="io-btn io-btn--solid"
              disabled={claimed}
              onClick={copy}
              type="button"
            >
              {copied ? (
                <>
                  <Check aria-hidden size={14} strokeWidth={2} /> Code copied
                </>
              ) : (
                <>
                  <Copy aria-hidden size={14} strokeWidth={1.7} /> Copy code
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
