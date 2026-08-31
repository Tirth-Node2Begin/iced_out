"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/* The modal opens over ANY route now — a product page, the wishlist, the bag —
   so the sheet that paints it cannot ride on the customer-session layout the
   way it did when checkout was a page of its own. It is imported here, beside
   the only component that needs it, and lands in every route's CSS. */
import "@/styles/checkout.css";

import { CheckoutFlow } from "@/features/04-cart/components/checkout-flow";
import { lockScroll } from "@/lib/scroll-lock";

/**
 * Checkout, as a surface rather than a destination.
 *
 * Everything about it is the same three steps that used to live at `/checkout`.
 * What changed is where they happen: over the page the shopper was already on,
 * so that closing it is a dismissal rather than a navigation, and the bag,
 * scroll position and route behind it are all exactly where they were left.
 *
 * Two dismissals are refused and one is not:
 *
 *   - While the money is in flight (`busy`), escape, the backdrop and the close
 *     button all do nothing. A gateway is holding an authorisation and there is
 *     no version of unmounting this that ends well.
 *   - Otherwise every one of them closes it, and nothing is lost — the draft is
 *     in storage and the bag is in the cart, so re-opening resumes mid-sentence.
 *
 * The nested surfaces (the card sheet, the full-bag list) open OVER this one
 * and are given their own layer in `checkout.css`; a nested Radix dialog would
 * otherwise share this one's z-index and put its own backdrop underneath.
 */
export function CheckoutModal({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  /* Stable, because the flow reports through it from an effect — a new function
     every render would make that effect fire on every render with it. */
  const handleBusy = useCallback((next: boolean) => setBusy(next), []);

  useEffect(() => {
    if (!open) return;
    return lockScroll();
  }, [open]);

  /**
   * Back closes it.
   *
   * The surface is not a route, so the history stack knows nothing about it and
   * a Back press would otherwise change the page UNDERNEATH an open checkout
   * and leave it floating over somewhere the shopper never opened it from.
   * Pressing Back while checking out means "leave checkout", and this is the
   * only reading of it that matches what is on screen.
   *
   * `popstate` and not the pathname, deliberately: it fires for Back and
   * Forward and for nothing else, so the `replace` that `/checkout` does on its
   * way to the bag — which happens in the same breath as opening this — is not
   * mistaken for the shopper leaving.
   */
  useEffect(() => {
    if (!open) return;

    const leave = () => {
      // Not mid-payment. A gateway holding an authorisation outranks a Back press.
      if (!busy) onOpenChange(false);
    };

    window.addEventListener("popstate", leave);
    return () => window.removeEventListener("popstate", leave);
  }, [busy, onOpenChange, open]);

  return (
    <Dialog.Root
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="io-modal__overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          className="io-modal io-modal--checkout"
          data-lenis-prevent
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="io-modal__head">
            <div>
              <Dialog.Title className="io-modal__title">Secure checkout</Dialog.Title>
              <p className="io-modal__note">
                Three steps. Sizes stay held until the order is placed.
              </p>
            </div>
            <Dialog.Close aria-label="Close checkout" className="io-modal__close" disabled={busy}>
              <X aria-hidden size={18} />
            </Dialog.Close>
          </div>

          <div className="io-modal__body co-modal__body">
            {/* Mounted only while open, so a surface that is closed and opened
                again starts at step 01 with no errors showing rather than
                resuming a validation state from a session the shopper walked
                away from. What it does NOT reset is the draft or the bag —
                those live in storage and are meant to survive. */}
            {open && <CheckoutFlow onBusy={handleBusy} onClose={close} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
