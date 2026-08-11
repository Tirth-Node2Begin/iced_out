"use client";

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  TriangleAlert,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { CouponField } from "@/components/commerce/coupon-field";
import { ProductImage } from "@/components/commerce/product-image";
import { PageFrame } from "@/components/layout/page-frame";
import { useAddresses } from "@/features/01-users/addresses-context";
import { useProfile } from "@/features/01-users/profile-context";
import { formatPrice } from "@/features/02-products";
import { useCart } from "@/features/04-cart/cart-context";
import {
  useCheckout,
  type CheckoutDraft,
  type PaymentMethod,
} from "@/features/04-cart/checkout-context";
import {
  addressSummary,
  addressToDraft,
  fillGaps,
  profileToDraft,
} from "@/features/04-cart/checkout-prefill";
import {
  STEP_ORDER,
  hasErrors,
  validateAll,
  validateStep,
  type Errors,
  type StepId,
} from "@/features/04-cart/checkout-validation";
import {
  DELIVERY_OPTIONS,
  deliveryEstimate,
  deliveryFee,
  deliveryOption,
  type DeliveryMethod,
} from "@/features/04-cart/delivery-options";
import { useOrders, type PaymentOutcome } from "@/features/07-orders/orders-context";
import { cardLabel, type CardDraft } from "@/features/09-payment/card";
import { CardPaymentSheet } from "@/features/09-payment/card-payment-sheet";
import { IS_TEST_KEY, loadRazorpay, openRazorpayCheckout } from "@/features/09-payment/razorpay";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Checkout — four steps on one screen, and the money beside them the whole way.
 *
 * It used to be five separate PAGE LOADS, then one long scroll, and it is now
 * neither: the four questions are asked one at a time against a rail that shows
 * where you are and what you already answered, but they all live on one route
 * with one form and one running total. That distinction is the whole design —
 * a step is a section that is currently open, not a navigation, so nothing is
 * lost to a reload, the Back button still means "leave checkout", and the total
 * never disappears behind a page transition.
 *
 * Payment happens here too. The gateway used to have a screen of its own, which
 * meant deciding HOW to pay was a different destination from deciding what to
 * pay for; now the method is step 04, the amount is settled in place, and the
 * only thing that opens elsewhere is the gateway's own frame — which is not a
 * page of ours to design.
 *
 * There are two ways out of the last step and they are not duplicates. The foot
 * of a step carries CONTINUE — the next question, one at a time. The summary
 * carries CHECKOUT — finish the order now, from wherever you are, which is the
 * only sensible control for a returning shopper whose first three steps arrived
 * pre-filled. Pressing it early is not refused: it runs every rule, and opens
 * the first step that fails rather than telling someone off for pressing it.
 *
 * The step is `<form id="io-checkout">`. The summary is not inside it, because
 * the coupon control it holds is itself a form and a `<form>` cannot contain
 * another — which is also why the checkout button is a `type="button"` that
 * calls the same code the form's submit does, rather than a second submitter.
 */
const FORM_ID = "io-checkout";

type Step = {
  id: StepId;
  label: string;
  title: string;
  note: string;
  icon: typeof UserRound;
  /** What the rail shows once the step has been answered. */
  summary: (draft: CheckoutDraft) => string;
};

const STEPS: Step[] = [
  {
    id: "contact",
    label: "Contact",
    title: "Who is this order for?",
    note: "Where the confirmation and every delivery update is sent.",
    icon: UserRound,
    summary: (draft) => draft.name || "Name, email and mobile",
  },
  {
    id: "address",
    label: "Address",
    title: "Where should it go?",
    note: "Serviceability and tax are confirmed against this address.",
    icon: MapPin,
    summary: (draft) =>
      draft.city ? `${draft.city}, ${draft.state} ${draft.postalCode}`.trim() : "Delivery address",
  },
  {
    id: "delivery",
    label: "Delivery",
    title: "How fast should it get there?",
    note: "Charged on the summary before anything is paid.",
    icon: Truck,
    summary: (draft) => deliveryOption(draft.deliveryMethod).label,
  },
  {
    id: "payment",
    label: "Payment",
    title: "How is it being paid for?",
    note: "Pick a method here — the details are asked for when you pay.",
    icon: Wallet,
    summary: (draft) =>
      PAYMENT_OPTIONS.find((option) => option.id === draft.paymentMethod)?.label ?? "Payment",
  },
];

const DELIVERY_ICONS = { standard: Truck, express: Zap } as const;

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethod;
  label: string;
  note: string;
  when: string;
  icon: typeof CreditCard;
}> = [
  {
    id: "cod",
    label: "Cash on delivery",
    note: "Pay the courier when the parcel arrives",
    when: "On delivery",
    icon: Banknote,
  },
  {
    id: "card",
    label: "Credit or debit card",
    note: "Visa · Mastercard · Amex · RuPay",
    when: "Now",
    icon: CreditCard,
  },
  {
    id: "razorpay",
    label: "Razorpay",
    note: "UPI · Netbanking · Wallets · Cards",
    when: "Now",
    icon: Wallet,
  },
];

type Status = "idle" | "paying" | "done";

/** `mobile` → `co-mobile`. The one place the field ids are decided. */
const fieldId = (field: string) => `co-${field}`;

export function CheckoutPage() {
  const hydrated = useHydrated();
  const router = useRouter();

  const { lines, itemCount, subtotal, coupon, discount, total, clearCart } = useCart();
  const { draft, restored, updateDraft, resetDraft } = useCheckout();
  const { placeOrder } = useOrders();
  const { profile, ready: profileReady } = useProfile();
  const { addresses, defaultAddress, ready: addressesReady } = useAddresses();

  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<string | null>(null);
  /** Open only between pressing pay with a card selected and the card arriving. */
  const [cardSheet, setCardSheet] = useState(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const railRef = useRef<HTMLDivElement>(null);

  const delivery = deliveryFee(draft.deliveryMethod, subtotal);
  const payable = total + delivery;
  const empty = lines.length === 0;

  /* ------------------------------------------------------------- pre-fill */
  /* Runs once, and only into fields that are EMPTY. The account is a starting
     point, not an authority: a shopper who has already typed an address is
     mid-decision, and a screen that overwrites that on a re-render — or when
     the profile saves in another tab — cannot be trusted with a delivery. */
  const prefillDone = useRef(false);

  useEffect(() => {
    if (prefillDone.current) return;
    if (!restored || !profileReady || !addressesReady) return;
    prefillDone.current = true;

    const source: Partial<CheckoutDraft> = {
      ...profileToDraft(profile),
      // The book's recipient name wins over the account holder's: the parcel is
      // addressed to whoever the destination says, and they are not always the
      // same person.
      ...(defaultAddress ? addressToDraft(defaultAddress) : {}),
    };

    const patch = fillGaps(draft, source);
    if (Object.keys(patch).length === 0) return;

    updateDraft(patch);
  }, [addressesReady, defaultAddress, draft, profile, profileReady, restored, updateDraft]);

  /* Derived, not remembered. The note is true whenever this step already holds
     what the account holds — which is the state prefill leaves it in, and,
     harmlessly, the state a shopper who typed the same details is in too.
     Deriving it is also what keeps a second state update from chasing the
     first one across a render it cannot add anything to. */
  const fromAccount =
    draft.name.trim().length > 0 &&
    draft.email.trim().toLowerCase() === profile.email.trim().toLowerCase();

  /* The gateway script is ~50 KB and a cold fetch is the difference between a
     modal that appears and a button that seems stuck. Asked for as soon as the
     shopper lands on the step that might need it, never before — the storefront
     should not carry a payment SDK on every page. */
  useEffect(() => {
    if (step.id === "payment" && draft.paymentMethod === "razorpay") void loadRazorpay();
  }, [draft.paymentMethod, step.id]);

  /* ---------------------------------------------------------- step moving */
  const stepState = useMemo(
    () => STEPS.map((entry) => !hasErrors(validateStep(entry.id, draft))),
    [draft],
  );

  /** Every step answered — the state in which one press finishes the order. */
  const ready = stepState.every(Boolean);
  /** The first step that is not, so the checkout button can name it. */
  const missing = ready ? null : STEPS[stepState.findIndex((clean) => !clean)];

  /**
   * Send the cursor to the first thing that was refused.
   *
   * Recorded here and acted on in the effect below rather than called straight
   * out of the handler: refusing a step can also CHANGE the step, and the input
   * that is about to be focused does not exist in the DOM until React has
   * committed that render. An effect runs after the commit, which is the only
   * moment `getElementById` is guaranteed to find it.
   */
  const focusTarget = useRef<string | null>(null);

  const focusFirstError = useCallback((problems: Errors) => {
    focusTarget.current = Object.keys(problems)[0] ?? null;
  }, []);

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    document.getElementById(fieldId(target))?.focus();
  });

  const scrollToTop = useCallback(() => {
    const node = railRef.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  /**
   * Moving about the rail.
   *
   * Backwards is always free — a step already answered cannot become wrong by
   * being looked at. Forwards walks every step in between and stops at the
   * first one that does not pass, with its errors showing, because a rail that
   * lets someone jump to Payment past an empty address is a rail that has to
   * throw them back out of it a second later.
   */
  const goTo = useCallback(
    (target: number) => {
      if (target === stepIndex) return;

      if (target < stepIndex) {
        setErrors({});
        setAttempted(false);
        setStepIndex(target);
        scrollToTop();
        return;
      }

      for (let index = stepIndex; index < target; index += 1) {
        const problems = validateStep(STEPS[index].id, draft);
        if (!hasErrors(problems)) continue;

        setStepIndex(index);
        setErrors(problems);
        setAttempted(true);
        focusFirstError(problems);
        scrollToTop();
        return;
      }

      setErrors({});
      setAttempted(false);
      setStepIndex(target);
      scrollToTop();
    },
    [draft, focusFirstError, scrollToTop, stepIndex],
  );

  /** Writes a field and drops the complaint about it in the same gesture. */
  const setField = useCallback((field: keyof CheckoutDraft, value: string) => {
    updateDraft({ [field]: value } as Partial<CheckoutDraft>);
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, [updateDraft]);

  /* -------------------------------------------------------- placing it all */

  /**
   * Everything after the money is settled, whichever way it settled.
   *
   * A failed payment still writes an order. The alternative is throwing away a
   * filled bag because a card bounced, and the shopper is then asked to rebuild
   * it from memory — so the order is recorded as unpaid, the bag is released
   * into it, and the order screen is where the second attempt happens.
   */
  const complete = useCallback(
    (payment: { method: string; reference: string; outcome: PaymentOutcome; note?: string }) => {
      const option = deliveryOption(draft.deliveryMethod);

      const order = placeOrder({
        lines,
        contact: { name: draft.name, email: draft.email, mobile: draft.mobile },
        address: {
          line: draft.address,
          city: draft.city,
          state: draft.state,
          postalCode: draft.postalCode,
        },
        delivery: {
          label: option.label,
          estimate: deliveryEstimate(draft.deliveryMethod),
          fee: delivery,
        },
        payment,
        money: { subtotal, discount, total: payable, couponCode: coupon?.code ?? null },
      });

      /* `status` is latched first, or emptying the bag repaints this screen as
         "your bag is empty" in the frame before the route changes. */
      setStatus("done");
      setCardSheet(false);
      clearCart();
      resetDraft();

      /* `replace`, so Back from the order goes to the bag rather than to a
         checkout for an order that has already been placed. */
      router.replace(
        `/account/orders/${order.id}?placed=${payment.outcome === "failed" ? "0" : "1"}`,
      );
    },
    [
      clearCart,
      coupon,
      delivery,
      discount,
      draft,
      lines,
      payable,
      placeOrder,
      resetDraft,
      router,
      subtotal,
    ],
  );

  const payAndPlace = useCallback(async () => {
    setFailure(null);

    /* Re-checked in full at the last moment, not just the step being left: a
       bag emptied in another tab, or a draft edited in storage, is a state no
       amount of step validation upstream can have caught. */
    if (hasErrors(validateAll(draft))) {
      const broken = Math.max(0, STEP_ORDER.findIndex((id) => hasErrors(validateStep(id, draft))));
      const problems = validateStep(STEP_ORDER[broken], draft);

      setStepIndex(broken);
      setErrors(problems);
      setAttempted(true);
      focusFirstError(problems);
      scrollToTop();
      return;
    }
    if (empty) return;

    if (draft.paymentMethod === "cod") {
      // No gateway reference to quote — the money has not moved. Inventing one
      // would put a plausible id on a receipt no system could be asked about.
      complete({
        method: "Cash on delivery",
        reference: "Collected at delivery",
        outcome: "due",
      });
      return;
    }

    if (draft.paymentMethod === "card") {
      /* The card is asked for HERE, not on the page behind — the checkout only
         ever picked the method. The sheet resolves into `payWithCard` below or
         is cancelled, and cancelling places nothing. */
      setCardSheet(true);
      return;
    }

    setStatus("paying");
    const option = deliveryOption(draft.deliveryMethod);
    const result = await openRazorpayCheckout({
      amount: payable,
      description: `${itemCount} ${itemCount === 1 ? "piece" : "pieces"} · Iced_out`,
      customer: { name: draft.name, email: draft.email, contact: draft.mobile },
      notes: { destination: `${draft.city}, ${draft.state}`, delivery: option.label },
    });

    if (result.ok) {
      complete({
        method: "Razorpay · Card / UPI / Netbanking",
        reference: result.paymentId,
        outcome: "captured",
      });
      return;
    }

    /* The gateway could not even be reached — no attempt was made, so there is
       nothing to record. This is the one failure that stays on the checkout,
       because retrying it is a matter of the connection rather than the card. */
    if (result.reason === "unavailable") {
      setStatus("idle");
      setFailure(result.message);
      return;
    }

    complete({
      method: "Razorpay",
      reference: result.reason === "dismissed" ? "Closed before completing" : "Declined",
      outcome: "failed",
      note: result.message,
    });
  }, [complete, draft, empty, focusFirstError, itemCount, payable, scrollToTop]);

  /**
   * The card, back from the sheet and on its way to nowhere else.
   *
   * There is no acquirer behind this build, so the authorisation is SIMULATED
   * and the receipt says so in as many words rather than quoting an id that no
   * system could be asked about. What is written onto the order is the brand
   * and the last four digits; the number, expiry and CVV go out of scope when
   * this function returns and were never in the checkout draft to begin with.
   */
  const payWithCard = useCallback(
    (card: CardDraft) => {
      setStatus("paying");
      complete({
        method: cardLabel(card),
        reference: "Authorised on device",
        outcome: "captured",
        note: "Card authorisation is simulated in this build — connect an acquirer to charge it.",
      });
    },
    [complete],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problems = validateStep(step.id, draft);
    if (hasErrors(problems)) {
      setErrors(problems);
      setAttempted(true);
      focusFirstError(problems);
      return;
    }

    if (!isLast) {
      setErrors({});
      setAttempted(false);
      setStepIndex(stepIndex + 1);
      scrollToTop();
      return;
    }

    void payAndPlace();
  }

  /* ---------------------------------------------------------------- gates */

  if (status === "done") {
    return (
      <PageFrame eyebrow="Checkout" title={<>Confirming your <em>order</em></>}>
        <div className="co-load" role="status">
          <Loader2 aria-hidden className="co-spin" size={16} />
          Writing your order…
        </div>
      </PageFrame>
    );
  }

  /* The bag is restored after mount, so the first paint of a statically
     exported page has nothing in it. Judging it that early paints "your bag is
     empty" over a bag that is about to arrive. */
  if (!hydrated) {
    return (
      <PageFrame eyebrow="Checkout" title={<>Secure <em>checkout</em></>}>
        <div className="co-load" role="status">
          Opening your bag…
        </div>
      </PageFrame>
    );
  }

  if (empty) {
    return (
      <PageFrame
        eyebrow="Checkout"
        lede="There is nothing to check out yet."
        title={<>Secure <em>checkout</em></>}
      >
        <div className="io-empty">
          <div className="io-empty__copy">
            <span className="io-empty__glyph">
              <ShoppingBag aria-hidden size={20} strokeWidth={1.4} />
            </span>
            <h2>Your bag is empty.</h2>
            <p>Add a piece from the current drop and it will be held here with its size.</p>
          </div>
          <Link className="io-btn io-btn--solid" href="/new-drop">
            Shop the drop
            <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      </PageFrame>
    );
  }

  const StepIcon = step.icon;

  /* ----------------------------------------------------------------- page */

  return (
    <PageFrame
      eyebrow="Checkout"
      lede="Four steps, one screen. Sizes stay held until the order is placed."
      spec={[
        { label: "Step", value: `${stepIndex + 1} of ${STEPS.length}` },
        { label: "Payable", value: formatPrice(payable) },
      ]}
      title={<>Secure <em>checkout</em></>}
    >
      <div className="co">
        <div className="co__main">
          {/* ------------------------------------------------------- the rail */}
          <div className="co-rail" ref={railRef}>
            <ol className="co-rail__list">
              {STEPS.map((entry, index) => {
                const state =
                  index === stepIndex ? "current" : stepState[index] ? "done" : "waiting";

                return (
                  <li className="co-rail__item" data-state={state} key={entry.id}>
                    <button
                      aria-current={index === stepIndex ? "step" : undefined}
                      className="co-rail__btn"
                      disabled={status === "paying"}
                      onClick={() => goTo(index)}
                      type="button"
                    >
                      <span className="co-rail__dot">
                        {state === "done" ? (
                          <Check aria-hidden size={13} strokeWidth={2.6} />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="co-rail__label">
                        <strong>{entry.label}</strong>
                        <small>{state === "waiting" ? entry.note : entry.summary(draft)}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div aria-hidden className="co-rail__track">
              <span style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }} />
            </div>
          </div>

          {failure && (
            <div className="co-alert" role="alert">
              <TriangleAlert aria-hidden size={16} strokeWidth={1.7} />
              <p>
                <strong>Payment not started</strong>
                {failure}
              </p>
            </div>
          )}

          {/* ------------------------------------------------------ the step */}
          <form
            className="co-step"
            data-attempted={attempted || undefined}
            id={FORM_ID}
            noValidate
            onSubmit={submit}
          >
            <header className="co-card__head">
              <span aria-hidden className="co-card__step">
                <StepIcon size={15} strokeWidth={1.7} />
              </span>
              <div>
                <h2 className="co-card__title">{step.title}</h2>
                <p className="co-card__note">{step.note}</p>
              </div>
              <span className="co-step__count">
                {String(stepIndex + 1).padStart(2, "0")}
                <i>/{String(STEPS.length).padStart(2, "0")}</i>
              </span>
            </header>

            {/* ---------------------------------------------------- 01 contact */}
            {step.id === "contact" && (
              <>
                {fromAccount && (
                  <p className="co-prefill">
                    <Sparkles aria-hidden size={13} strokeWidth={1.8} />
                    These came from your account
                    {defaultAddress ? `, along with your ${defaultAddress.label.toLowerCase()} address` : ""}.
                    Change anything that is not right.
                  </p>
                )}

                <div className="co-fields">
                  <Field
                    autoComplete="name"
                    error={errors.name}
                    field="name"
                    label="Full name"
                    onChange={(value) => setField("name", value)}
                    placeholder="As it should appear on the parcel"
                    value={draft.name}
                    wide
                  />
                  <Field
                    autoComplete="email"
                    error={errors.email}
                    field="email"
                    label="Email"
                    onChange={(value) => setField("email", value)}
                    placeholder="you@example.com"
                    type="email"
                    value={draft.email}
                  />
                  <Field
                    autoComplete="tel"
                    error={errors.mobile}
                    field="mobile"
                    inputMode="tel"
                    label="Mobile"
                    onChange={(value) => setField("mobile", value)}
                    placeholder="+91 98765 43210"
                    type="tel"
                    value={draft.mobile}
                  />
                </div>
              </>
            )}

            {/* ---------------------------------------------------- 02 address */}
            {step.id === "address" && (
              <>
                {addresses.length > 0 && (
                  <div className="co-saved">
                    <p className="co-saved__label">Saved addresses</p>
                    <div className="co-saved__list">
                      {addresses.map((address) => (
                        <button
                          className="co-saved__chip"
                          key={address.id}
                          onClick={() => {
                            /* An explicit press, so this one DOES overwrite —
                               picking a saved address that then only half
                               applies is worse than not offering the list. */
                            updateDraft(addressToDraft(address));
                            setErrors({});
                          }}
                          type="button"
                        >
                          <MapPin aria-hidden size={13} strokeWidth={1.8} />
                          <span>
                            <strong>{address.label}</strong>
                            <small>{addressSummary(address)}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="co-fields">
                  <Field
                    autoComplete="street-address"
                    error={errors.address}
                    field="address"
                    label="Address"
                    onChange={(value) => setField("address", value)}
                    placeholder="Flat, building, street"
                    value={draft.address}
                    wide
                  />
                  <Field
                    autoComplete="address-level2"
                    error={errors.city}
                    field="city"
                    label="City"
                    onChange={(value) => setField("city", value)}
                    placeholder="Bengaluru"
                    third
                    value={draft.city}
                  />
                  <Field
                    autoComplete="address-level1"
                    error={errors.state}
                    field="state"
                    label="State"
                    onChange={(value) => setField("state", value)}
                    placeholder="Karnataka"
                    third
                    value={draft.state}
                  />
                  <Field
                    autoComplete="postal-code"
                    error={errors.postalCode}
                    field="postalCode"
                    inputMode="numeric"
                    label="PIN code"
                    maxLength={6}
                    onChange={(value) => setField("postalCode", value.replace(/\D/g, ""))}
                    placeholder="560001"
                    third
                    value={draft.postalCode}
                  />
                </div>
              </>
            )}

            {/* --------------------------------------------------- 03 delivery */}
            {step.id === "delivery" && (
              <div className="co-choices">
                {DELIVERY_OPTIONS.map((option) => {
                  const Icon = DELIVERY_ICONS[option.id];
                  const fee = deliveryFee(option.id, subtotal);
                  const selected = draft.deliveryMethod === option.id;

                  return (
                    <label className="co-choice" data-selected={selected || undefined} key={option.id}>
                      <input
                        checked={selected}
                        name="delivery"
                        onChange={() => setField("deliveryMethod", option.id as DeliveryMethod)}
                        type="radio"
                        value={option.id}
                      />
                      <span className="co-choice__glyph">
                        <Icon aria-hidden size={16} strokeWidth={1.6} />
                      </span>
                      <span className="co-choice__body">
                        <strong>{option.label}</strong>
                        <small>{option.window} · {option.note}</small>
                      </span>
                      <span className="co-choice__price">
                        {fee === 0 ? "Free" : formatPrice(fee)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* ---------------------------------------------------- 04 payment */}
            {step.id === "payment" && (
              <>
                {/* What is about to be committed to, with a way back to each
                    answer — a confirmation step that hides what it confirms is
                    a button, not a review. */}
                <div className="co-review">
                  <ReviewRow
                    label="Contact"
                    lines={[draft.name, `${draft.email} · ${draft.mobile}`]}
                    onEdit={() => goTo(0)}
                  />
                  <ReviewRow
                    label="Delivering to"
                    lines={[
                      draft.address,
                      `${draft.city}, ${draft.state} ${draft.postalCode}`,
                    ]}
                    onEdit={() => goTo(1)}
                  />
                  <ReviewRow
                    label="Delivery"
                    lines={[
                      deliveryOption(draft.deliveryMethod).label,
                      `${deliveryOption(draft.deliveryMethod).window} · ${
                        delivery === 0 ? "Free" : formatPrice(delivery)
                      }`,
                    ]}
                    onEdit={() => goTo(2)}
                  />
                </div>

                <div className="co-choices">
                  {PAYMENT_OPTIONS.map((method) => {
                    const Icon = method.icon;
                    const selected = draft.paymentMethod === method.id;

                    return (
                      <label
                        className="co-choice"
                        data-selected={selected || undefined}
                        key={method.id}
                      >
                        <input
                          checked={selected}
                          disabled={status === "paying"}
                          name="payment"
                          onChange={() => setField("paymentMethod", method.id)}
                          type="radio"
                          value={method.id}
                        />
                        <span className="co-choice__glyph">
                          <Icon aria-hidden size={16} strokeWidth={1.6} />
                        </span>
                        <span className="co-choice__body">
                          <strong>{method.label}</strong>
                          <small>{method.note}</small>
                        </span>
                        <span className="co-choice__price">{method.when}</span>
                      </label>
                    );
                  })}
                </div>

                {draft.paymentMethod === "cod" && (
                  <p className="co-card__foot">
                    The order is placed now and {formatPrice(payable)} is collected at the door.
                    Keep the exact amount if you can — couriers rarely carry change.
                  </p>
                )}

                {draft.paymentMethod === "card" && (
                  <p className="co-card__foot">
                    <Lock aria-hidden size={12} strokeWidth={1.8} />
                    The card is asked for when you press pay, not here — it is checked in this
                    browser, never saved, and only the brand and last four digits reach the order.
                  </p>
                )}

                {draft.paymentMethod === "razorpay" && (
                  <>
                    <p className="co-card__foot">
                      <Lock aria-hidden size={12} strokeWidth={1.8} />
                      Razorpay opens its own secure frame over this page when you press pay. No
                      card number, UPI PIN or CVV is entered on this site, and the order is placed
                      only once the gateway answers.
                    </p>

                    {IS_TEST_KEY && (
                      <section className="co-testcard">
                        <h3>
                          <ShieldCheck aria-hidden size={14} strokeWidth={1.7} />
                          Razorpay test mode
                        </h3>
                        <p>
                          This build runs on a test key, so no real money moves. Use card{" "}
                          <code>4111 1111 1111 1111</code> with any future expiry and CVV, OTP{" "}
                          <code>1234</code> — or UPI id <code>success@razorpay</code>. Live keys
                          go in <code>NEXT_PUBLIC_RAZORPAY_KEY_ID</code>.
                        </p>
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {/* ------------------------------------------------------ the feet */}
            <div className="co-step__feet">
              {stepIndex === 0 ? (
                <Link className="io-btn io-btn--ghost" href="/cart">
                  <ArrowLeft aria-hidden size={15} />
                  Back to bag
                </Link>
              ) : (
                <button
                  className="io-btn io-btn--ghost"
                  disabled={status === "paying"}
                  onClick={() => goTo(stepIndex - 1)}
                  type="button"
                >
                  <ArrowLeft aria-hidden size={15} />
                  {STEPS[stepIndex - 1].label}
                </button>
              )}

              <button className="io-btn io-btn--solid" disabled={status === "paying"} type="submit">
                {status === "paying" ? (
                  <>
                    <Loader2 aria-hidden className="co-spin" size={15} />
                    Waiting for the gateway…
                  </>
                ) : !isLast ? (
                  <>
                    Continue
                    <ArrowRight aria-hidden size={15} />
                  </>
                ) : draft.paymentMethod === "cod" ? (
                  <>
                    Place order · {formatPrice(payable)}
                    <ArrowRight aria-hidden size={15} />
                  </>
                ) : (
                  <>
                    Pay {formatPrice(payable)}
                    <ArrowRight aria-hidden size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ------------------------------------------------------- summary */}
        <aside className="co__aside">
          <div className="co-summary">
            <header className="co-summary__head">
              <h2>Order summary</h2>
              <span>{itemCount} {itemCount === 1 ? "piece" : "pieces"}</span>
            </header>

            <ul className="co-summary__lines">
              {lines.map((line) => (
                <li key={`${line.product.id}-${line.size}`}>
                  <span className="co-summary__media">
                    <ProductImage position={line.product.imagePosition} />
                    <i>{line.quantity}</i>
                  </span>
                  <span className="co-summary__body">
                    <strong>{line.product.name}</strong>
                    <small>{line.product.color} · Size {line.size}</small>
                  </span>
                  <span className="co-summary__price">
                    {formatPrice(line.product.price * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <CouponField />

            <dl className="co-summary__totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="io-off">
                  <dt>{coupon?.code}</dt>
                  <dd>−{formatPrice(discount)}</dd>
                </div>
              )}
              <div>
                <dt>Delivery</dt>
                <dd>{delivery === 0 ? "Free" : formatPrice(delivery)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>Included</dd>
              </div>
              <div className="co-summary__total">
                <dt>{draft.paymentMethod === "cod" ? "Due on delivery" : "Payable"}</dt>
                <dd>{formatPrice(payable)}</dd>
              </div>
            </dl>

            {/* ------------------------------------------------------ checkout */}
            {/* The one button that finishes the order, available from every
                step rather than only the last. With the account pre-filling
                three of the four steps, a returning shopper's checkout is
                genuinely one press — and pressing it early is not an error:
                it runs the whole form, and if something really is missing it
                opens the step that is missing it instead of refusing. */}
            <button
              className="io-btn io-btn--solid io-btn--wide"
              disabled={status === "paying"}
              onClick={() => void payAndPlace()}
              type="button"
            >
              {status === "paying" ? (
                <>
                  <Loader2 aria-hidden className="co-spin" size={15} />
                  Waiting for the gateway…
                </>
              ) : !ready ? (
                <>
                  Checkout · {formatPrice(payable)}
                  <ArrowRight aria-hidden size={15} />
                </>
              ) : draft.paymentMethod === "cod" ? (
                <>
                  Place order · {formatPrice(payable)}
                  <ArrowRight aria-hidden size={15} />
                </>
              ) : draft.paymentMethod === "card" ? (
                <>
                  Pay {formatPrice(payable)} by card
                  <ArrowRight aria-hidden size={15} />
                </>
              ) : (
                <>
                  Pay {formatPrice(payable)} via Razorpay
                  <ArrowRight aria-hidden size={15} />
                </>
              )}
            </button>

            {/* Named, so the button is a door rather than a wall. */}
            {!ready && missing && (
              <p className="co-summary__hint">
                {missing.label} still needs finishing — pressing checkout opens it.
              </p>
            )}

            <ul className="co-trust">
              <li>
                <Lock aria-hidden size={13} strokeWidth={1.7} />
                Card and UPI details are entered on the payment surface, never stored here
              </li>
              <li>
                <Check aria-hidden size={13} strokeWidth={1.7} />
                Sizes stay held until the order is placed
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {/* The card surface, over the checkout rather than inside it. Cancelling
          it places nothing and charges nothing — the bag and every answer are
          exactly where they were left. */}
      <CardPaymentSheet
        amount={payable}
        onCancel={() => {
          setCardSheet(false);
          setStatus("idle");
        }}
        onPaid={payWithCard}
        open={cardSheet}
      />
    </PageFrame>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One labelled input and the sentence it is refused with.
 *
 * The error is a sibling of the input rather than a line somewhere else on the
 * page, and it is wired with `aria-describedby` — a red outline says something
 * is wrong to people who can see it, and nothing at all to anyone listening.
 */
function Field({
  autoComplete,
  error,
  field,
  inputMode,
  label,
  maxLength,
  onChange,
  placeholder,
  third,
  type = "text",
  value,
  wide,
}: {
  autoComplete?: string;
  error?: string;
  field: string;
  inputMode?: "tel" | "numeric";
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  third?: boolean;
  type?: string;
  value: string;
  wide?: boolean;
}) {
  const id = fieldId(field);
  const className = `co-field${wide ? " co-field--wide" : ""}${third ? " co-field--third" : ""}`;

  return (
    <label className={className} htmlFor={id}>
      <span>{label}</span>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        id={id}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error && (
        <em className="co-error" id={`${id}-error`}>
          {error}
        </em>
      )}
    </label>
  );
}

/** One answered step, quoted back on the payment step with a way to change it. */
function ReviewRow({
  label,
  lines,
  onEdit,
}: {
  label: string;
  lines: string[];
  onEdit: () => void;
}) {
  return (
    <div className="co-review__row">
      <span className="co-review__label">{label}</span>
      <span className="co-review__body">
        {lines.filter(Boolean).map((line, index) => (
          <span key={line + index}>{line}</span>
        ))}
      </span>
      <button className="co-review__edit" onClick={onEdit} type="button">
        <Pencil aria-hidden size={12} strokeWidth={1.8} />
        Edit
      </button>
    </div>
  );
}
