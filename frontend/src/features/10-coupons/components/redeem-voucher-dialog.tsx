"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Ticket, X } from "lucide-react";
import { useEffect, useState } from "react";

import { formatPrice } from "@/features/02-products/utils/format-price";
import { formatDay, isClaimed, voucherPurpose, type Voucher } from "@/features/10-coupons/vouchers";

/**
 * One voucher, in full: the code big enough to read, and where its money went.
 *
 * The dialog does NOT move anything. Adding a voucher to the wallet is the row
 * action behind it — see `account-vouchers` — and this is the record: what it
 * was for, when it was issued, and whether its value is now sitting in the
 * balance. Copying the code is still offered because a code is a thing people
 * quote to support, but it is no longer a step in spending one: there is no
 * coupon box to paste it into any more, and there has not been since credit
 * became a balance rather than a one-shot token.
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
                {claimed ? "Already added" : "This voucher"}
              </Dialog.Title>
              <Dialog.Description className="io-modal__note">
                {claimed
                  ? voucher.claimedOrder === "Wallet"
                    ? `Added to your wallet on ${formatDay(voucher.claimedOn)}. Its value is part of your balance now — the wallet's statement shows where it goes from here.`
                    : `Spent on order ${voucher.claimedOrder || "one of yours"} on ${formatDay(voucher.claimedOn)}.`
                  : "Add it to your wallet and the full value joins your balance, to be spent a rupee at a time across as many orders as it takes."}
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
                {claimed ? "Added" : "Ready"}
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
                <dt>{claimed ? "Added" : "Add before"}</dt>
                <dd>{formatDay(claimed ? voucher.claimedOn : voucher.expiresOn)}</dd>
              </div>
            </dl>

            {!claimed && (
              <p className="io-voucher__rule">
                It is added once. From then on the money lives in your wallet, comes off your
                orders automatically, and whatever a small order does not use stays there.
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
