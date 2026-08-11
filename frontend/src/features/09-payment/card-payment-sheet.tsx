"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { formatPrice } from "@/features/02-products";
import { validateCard, type Errors } from "@/features/04-cart/checkout-validation";
import {
  cardBrand,
  cvvLength,
  emptyCard,
  formatCardNumber,
  formatExpiry,
  type CardDraft,
} from "@/features/09-payment/card";

/**
 * Where a card is actually keyed.
 *
 * Deliberately NOT on the checkout page. Checkout selects a method — that is
 * the whole of its job at step 04 — and the details for whichever method was
 * selected are asked for at the moment the money moves, which is what Razorpay
 * does with its own frame and what this does for a card. Three reasons it is
 * built this way rather than as four more fields in the form:
 *
 *   1. A shopper who picks cash on delivery is never shown a card form, and a
 *      shopper who picks a card is never asked for it until they have decided
 *      to pay. Neither is looking at fields that do not apply to them.
 *   2. The number lives in this component's state and dies with it. There is
 *      nothing to clear out of the checkout draft, so there is nothing to leak
 *      into `localStorage` the way every other field on that page is persisted.
 *   3. Cancelling is unambiguous. Closing a payment surface cancels a payment;
 *      clearing four fields in the middle of a long form means nothing.
 *
 * What it is NOT: a PCI-compliant card form. There is no acquirer behind this
 * build, so a submitted card is checked and then the order is placed against a
 * SIMULATED authorisation. Every real deployment should route cards through the
 * gateway instead — see `razorpay.ts` — so the number never reaches this origin.
 */
export function CardPaymentSheet({
  amount,
  onCancel,
  onPaid,
  open,
}: {
  amount: number;
  onCancel: () => void;
  /** Handed the validated card. Only the brand and last four should survive. */
  onPaid: (card: CardDraft) => void;
  open: boolean;
}) {
  const formId = useId();
  const [card, setCard] = useState<CardDraft>(emptyCard);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const brand = cardBrand(card.number);

  /** Writes a field and drops the complaint about it in the same gesture. */
  function set(field: keyof CardDraft, value: string) {
    setCard((current) => ({ ...current, [field]: value }));

    const key = `card${field[0].toUpperCase()}${field.slice(1)}`;
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problems = validateCard(card);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      const first = Object.keys(problems)[0];
      window.requestAnimationFrame(() => document.getElementById(`${formId}-${first}`)?.focus());
      return;
    }

    setBusy(true);
    /* The card is handed over and forgotten in the same breath. Whatever the
       caller does with it, this component is not the thing holding a PAN while
       a route changes. */
    onPaid(card);
    setCard(emptyCard);
  }

  function close(next: boolean) {
    if (next || busy) return;
    setCard(emptyCard);
    setErrors({});
    onCancel();
  }

  const field = (name: string) => `${formId}-${name}`;

  return (
    <Dialog.Root onOpenChange={close} open={open}>
      <Dialog.Portal>
        {/* `--top`, because this opens over the checkout modal — see the layer
            note in checkout.css §0. */}
        <Dialog.Overlay className="io-modal__overlay io-modal__overlay--top" />
        <Dialog.Content className="io-modal io-modal--pay">
          <div className="io-modal__head">
            <div>
              <Dialog.Title className="io-modal__title">
                Pay {formatPrice(amount)}
              </Dialog.Title>
              <Dialog.Description className="io-modal__note">
                Card details are entered here, checked in this browser, and never saved.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Cancel payment" className="io-modal__close" disabled={busy}>
              <X aria-hidden size={18} />
            </Dialog.Close>
          </div>

          <div className="io-modal__body">
            <form className="co-fields" id={formId} noValidate onSubmit={submit}>
              <label className="co-field co-field--wide" htmlFor={field("cardNumber")}>
                <span>
                  Card number
                  {brand !== "Card" && <i className="co-brand">{brand}</i>}
                </span>
                <input
                  aria-describedby={errors.cardNumber ? `${field("cardNumber")}-error` : undefined}
                  aria-invalid={errors.cardNumber ? true : undefined}
                  autoComplete="cc-number"
                  autoFocus
                  disabled={busy}
                  id={field("cardNumber")}
                  inputMode="numeric"
                  onChange={(event) => set("number", formatCardNumber(event.target.value))}
                  placeholder="4111 1111 1111 1111"
                  value={card.number}
                />
                {errors.cardNumber && (
                  <em className="co-error" id={`${field("cardNumber")}-error`}>
                    {errors.cardNumber}
                  </em>
                )}
              </label>

              <label className="co-field co-field--wide" htmlFor={field("cardName")}>
                <span>Name on card</span>
                <input
                  aria-describedby={errors.cardName ? `${field("cardName")}-error` : undefined}
                  aria-invalid={errors.cardName ? true : undefined}
                  autoComplete="cc-name"
                  disabled={busy}
                  id={field("cardName")}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="As printed on the card"
                  value={card.name}
                />
                {errors.cardName && (
                  <em className="co-error" id={`${field("cardName")}-error`}>
                    {errors.cardName}
                  </em>
                )}
              </label>

              <label className="co-field" htmlFor={field("cardExpiry")}>
                <span>Expiry</span>
                <input
                  aria-describedby={errors.cardExpiry ? `${field("cardExpiry")}-error` : undefined}
                  aria-invalid={errors.cardExpiry ? true : undefined}
                  autoComplete="cc-exp"
                  disabled={busy}
                  id={field("cardExpiry")}
                  inputMode="numeric"
                  onChange={(event) => set("expiry", formatExpiry(event.target.value))}
                  placeholder="MM/YY"
                  value={card.expiry}
                />
                {errors.cardExpiry && (
                  <em className="co-error" id={`${field("cardExpiry")}-error`}>
                    {errors.cardExpiry}
                  </em>
                )}
              </label>

              <label className="co-field" htmlFor={field("cardCvv")}>
                <span>Security code</span>
                <input
                  aria-describedby={errors.cardCvv ? `${field("cardCvv")}-error` : undefined}
                  aria-invalid={errors.cardCvv ? true : undefined}
                  autoComplete="cc-csc"
                  disabled={busy}
                  id={field("cardCvv")}
                  inputMode="numeric"
                  onChange={(event) =>
                    set("cvv", event.target.value.replace(/\D/g, "").slice(0, cvvLength(brand)))
                  }
                  placeholder={brand === "Amex" ? "4 digits" : "3 digits"}
                  type="password"
                  value={card.cvv}
                />
                {errors.cardCvv && (
                  <em className="co-error" id={`${field("cardCvv")}-error`}>
                    {errors.cardCvv}
                  </em>
                )}
              </label>
            </form>

            <p className="co-paynote">
              <ShieldCheck aria-hidden size={13} strokeWidth={1.7} />
              Authorisation is simulated in this build — no acquirer is connected, so nothing is
              charged. Only the brand and the last four digits are written onto the order.
            </p>
          </div>

          <div className="io-modal__foot">
            <Dialog.Close className="io-btn io-btn--ghost" disabled={busy}>
              Cancel
            </Dialog.Close>
            <button className="io-btn io-btn--solid" disabled={busy} form={formId} type="submit">
              {busy ? (
                <>
                  <Loader2 aria-hidden className="co-spin" size={15} />
                  Authorising…
                </>
              ) : (
                <>
                  <Lock aria-hidden size={14} strokeWidth={1.8} />
                  Pay {formatPrice(amount)}
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
