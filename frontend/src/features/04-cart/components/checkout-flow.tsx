"use client";

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingBag,
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
import { BagDialog } from "@/features/04-cart/components/bag-dialog";
import { RegionField } from "@/features/04-cart/components/region-field";
import { useAddresses, type Address } from "@/features/01-users/addresses-context";
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
import {
  INDIAN_STATES,
  citiesOf,
  cityBelongsTo,
  withCurrent,
} from "@/features/04-cart/india-regions";
import { useOrders, type PaymentOutcome } from "@/features/07-orders/orders-context";
import { useVouchers } from "@/features/10-coupons/vouchers-context";
import { cardLabel, type CardDraft } from "@/features/09-payment/card";
import { CardPaymentSheet } from "@/features/09-payment/card-payment-sheet";
import { IS_TEST_KEY, loadRazorpay, openRazorpayCheckout } from "@/features/09-payment/razorpay";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Checkout — three steps on one surface, and the money beside them the whole way.
 *
 * It used to be five separate PAGE LOADS, then one long scroll, then one route,
 * and it is now none of those: the whole thing is a modal that opens over
 * whatever the shopper was looking at. That is the point — checkout is the last
 * thing between a full bag and an order, and sending someone to a different URL
 * to do it means a page load, a lost scroll position, and a Back button that
 * lands them somewhere they did not ask to be. Closing this puts them back
 * exactly where they were, with the bag and every answer still in it.
 *
 * The questions are asked one at a time against a rail that shows where you are
 * and what you already answered, but they all live in one form with one running
 * total. A step is a section that is currently open, not a navigation.
 *
 * There were four steps. Delivery and payment are now ONE, because they were
 * never two decisions: the speed prices the order and the method settles it, a
 * shopper reads both off the same total, and a step that shows two radio cards
 * and nothing else is a page load charged for a keystroke.
 *
 * Payment happens here too. The gateway used to have a screen of its own, which
 * meant deciding HOW to pay was a different destination from deciding what to
 * pay for; now the method sits under the delivery speed, the amount is settled
 * in place, and the only thing that opens elsewhere is the gateway's own frame
 * — which is not a page of ours to design.
 *
 * There are two ways out of the last step and they are not duplicates. The foot
 * of a step carries CONTINUE — the next question, one at a time. The summary
 * carries CHECKOUT — finish the order now, from wherever you are, which is the
 * only sensible control for a returning shopper whose first two steps arrived
 * pre-filled. Pressing it early is not refused: it runs every rule, and opens
 * the first step that fails rather than telling someone off for pressing it.
 *
 * The step is `<form id="io-checkout">`. The summary is not inside it, because
 * the coupon control it holds is itself a form and a `<form>` cannot contain
 * another — which is also why the checkout button is a `type="button"` that
 * calls the same code the form's submit does, rather than a second submitter.
 *
 * This renders the CONTENTS of the modal and knows nothing about the dialog
 * around it — see `checkout-modal.tsx` for the surface and
 * `checkout-modal-context.tsx` for the one way it is opened. What it does report
 * upwards is `onBusy`: while the gateway has the money, the surface must not be
 * dismissable, and only this component knows when that is.
 */
const FORM_ID = "io-checkout";

/** How many bag lines the summary prints before handing the rest to the modal. */
const SUMMARY_LINES = 3;

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
    label: "Personal/Receiver Details",
    title: "Personal/Receiver Details",
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
    id: "payment",
    label: "Delivery & Payment",
    title: "Delivery & payment",
    note: "How fast it ships, and how it is paid for.",
    icon: Wallet,
    summary: (draft) =>
      `${deliveryOption(draft.deliveryMethod).label} · ${
        PAYMENT_OPTIONS.find((option) => option.id === draft.paymentMethod)?.label ?? "Payment"
      }`,
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

export function CheckoutFlow({
  onBusy,
  onClose,
}: {
  /** True from the moment the money is in flight until it has settled. */
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const hydrated = useHydrated();
  const router = useRouter();

  const { lines, itemCount, subtotal, coupon, discount, total, clearCart } = useCart();
  const { draft, restored, updateDraft, resetDraft } = useCheckout();
  const { placeOrder } = useOrders();
  const { claim: claimVoucher } = useVouchers();
  const { profile, ready: profileReady } = useProfile();
  const { add: addAddress, addresses, defaultAddress, ready: addressesReady } = useAddresses();

  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<string | null>(null);
  /** Open only between pressing pay with a card selected and the card arriving. */
  const [cardSheet, setCardSheet] = useState(false);
  /** True while the address fields are being typed as a NEW destination. */
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  /** The whole bag, on its own surface, when the summary only shows the top. */
  const [bagOpen, setBagOpen] = useState(false);
  /** Step 01 shows what the account holds until the shopper asks to change it. */
  const [editingContact, setEditingContact] = useState(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const railRef = useRef<HTMLDivElement>(null);

  /* The surface above has a close button and an escape key, and neither may
     work while the money is being taken — dismissing it mid-authorisation is
     not a thing a shopper can mean.

     The cleanup matters as much as the flag: handing off to Razorpay unmounts
     this while `paying` is still true, and a flag left set would reopen a
     checkout whose close button no longer works. */
  useEffect(() => {
    onBusy(status === "paying");
    return () => onBusy(false);
  }, [onBusy, status]);

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

  /**
   * Whether step 01 can be READ rather than filled in.
   *
   * Derived from the same validation the rest of the screen runs, not from a
   * flag of its own — which is what makes every path that refuses this step
   * open the fields automatically: pressing Continue with a broken email, or
   * Checkout from step 03, or landing on a device where the account holds
   * nothing. There is no state to remember to set, so there is no path that can
   * forget to set it and focus a field that is not on screen.
   */
  const contactClean = stepState[0];
  const contactReadable = contactClean && !editingContact;

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

  /* ------------------------------------------------------------- addresses */

  /**
   * Which saved address the fields currently hold, if any.
   *
   * Derived rather than remembered, because the fields stay editable: change a
   * digit of a saved PIN and the chip stops being lit in the same keystroke,
   * which is the truth — what will be shipped to is what the fields say, not
   * what was clicked a minute ago.
   */
  const selectedAddressId = useMemo(() => {
    const match = addresses.find((address) => {
      const saved = addressToDraft(address);
      return (
        (saved.address ?? "") === draft.address &&
        (saved.city ?? "") === draft.city &&
        (saved.state ?? "") === draft.state &&
        (saved.postalCode ?? "") === draft.postalCode
      );
    });
    return match?.id ?? null;
  }, [addresses, draft.address, draft.city, draft.postalCode, draft.state]);

  /** The state select rewrites the city one, so the pair can never disagree. */
  const setStateField = useCallback(
    (value: string) => {
      const keepCity = cityBelongsTo(value, draft.city);
      updateDraft({ state: value, ...(keepCity ? {} : { city: "" }) });
      setErrors((current) => {
        const next = { ...current };
        delete next.state;
        if (!keepCity) delete next.city;
        return next;
      });
    },
    [draft.city, updateDraft],
  );

  /** Empties the four address fields and points the cursor at the first one. */
  const startNewAddress = useCallback(() => {
    setAddingAddress(true);
    setAddressLabel("");
    setSaveAddress(true);
    updateDraft({ address: "", city: "", state: "", postalCode: "" });
    setErrors({});
    focusTarget.current = "address";
  }, [updateDraft]);

  const pickSavedAddress = useCallback(
    (address: Address) => {
      /* An explicit press, so this one DOES overwrite — picking a saved address
         that then only half applies is worse than not offering the list. */
      updateDraft(addressToDraft(address));
      setAddingAddress(false);
      setErrors({});
    },
    [updateDraft],
  );

  /**
   * A newly typed address, into the book it will be reused from.
   *
   * Called on the way OUT of the address step rather than as it is typed: the
   * book should hold destinations, not the half-typed states of one. It clears
   * `addingAddress` first, so leaving the step twice — Continue, back, Continue
   * — cannot write the same address in twice.
   */
  const commitNewAddress = useCallback(() => {
    if (!addingAddress) return;
    setAddingAddress(false);
    if (!saveAddress) return;

    addAddress({
      label: addressLabel.trim() || "New address",
      name: draft.name.trim(),
      lines: [draft.address.trim(), `${draft.city}, ${draft.state} ${draft.postalCode}`.trim()],
      phone: draft.mobile.trim(),
    });
  }, [addAddress, addingAddress, addressLabel, draft, saveAddress]);

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

      /* The voucher is CLAIMED here and nowhere else — not by copying the code,
         not by putting it on the bag. From this moment it leaves the redeemable
         table, so it cannot be applied to a second order from any surface.

         Only against money that actually settled, though: a failed payment
         still writes an order — see above — and claiming the voucher for it
         would burn the customer's credit on something they have not bought,
         leaving them nothing to pay the retry with. It is a no-op for a
         promotional code; only a voucher can be claimed. */
      if (coupon && discount > 0 && payment.outcome !== "failed") {
        claimVoucher(coupon.code, order.number);
      }

      /* `status` is latched first, or emptying the bag repaints this screen as
         "your bag is empty" in the frame before the route changes. */
      setStatus("done");
      setCardSheet(false);
      clearCart();
      resetDraft();

      /* `/orders/<id>`, not the archive entry under `/account`: a purchase
         should land on the screen that answers "did it work and what happens
         next", and the account's order section answers a different question
         weeks later. Both read the same record — see `orders-context`.

         `replace`, so Back from the order goes to the bag rather than to a
         checkout for an order that has already been placed. */
      router.replace(`/orders/${order.id}?placed=${payment.outcome === "failed" ? "0" : "1"}`);

      /* And the surface itself goes. It is a modal now, so nothing unmounts it
         on navigation — left open it would sit over the order it just wrote,
         holding an emptied bag it would repaint as "your bag is empty". */
      onClose();
    },
    [
      claimVoucher,
      clearCart,
      coupon,
      delivery,
      discount,
      draft,
      lines,
      onClose,
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

    /* Everything passed, so whatever was typed into the address step is a real
       destination and belongs in the book if it was asked to be. */
    commitNewAddress();

    /* A voucher can cover the whole bag, which no promotional code could — the
       best of those is a percentage, and a flat one has a minimum above its own
       value. So there is now a real path where nothing is left to pay, and
       neither the gateway nor a courier should be handed a bill for ₹0. The
       order is placed settled, against the credit that settled it. */
    if (payable <= 0) {
      complete({
        method: "Store credit",
        reference: coupon?.code ?? "Voucher",
        outcome: "captured",
        note: "Paid in full with store credit",
      });
      return;
    }

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

    /**
     * The gateway gets the screen to itself, and this closes to give it.
     *
     * Razorpay mounts its frame on `<body>`, and this checkout is a MODAL
     * dialog — which switches `pointer-events` off on the body and traps focus
     * inside itself. A third-party overlay opened underneath that contract is
     * not merely awkward, it is dead: nothing in it can be clicked, and every
     * attempt to focus a field in the iframe is snatched straight back by the
     * focus trap, which is what locked the tab up rather than taking a payment.
     *
     * So the script is fetched and CHECKED first, while this is still open and
     * can still say so if it cannot be reached — and only once the gateway is
     * known to be there does the surface close and hand over.
     */
    const ready = await loadRazorpay();
    if (!ready) {
      setStatus("idle");
      setFailure("The payment gateway could not be reached. Check the connection and try again.");
      return;
    }

    const option = deliveryOption(draft.deliveryMethod);
    onClose();

    /* From here this component is unmounted, and that is fine: the promise and
       everything it closes over outlive it, `complete` writes through contexts
       that live above this one, and the three state setters left below are
       no-ops on an unmounted tree. Every outcome — paid, dismissed, declined —
       ends on the order screen, which is where a second attempt belongs. */
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

    /* "Unreachable" is now caught by the check above, while this was still on
       screen to report it — anything that gets past that has been in front of
       the shopper, so it is recorded rather than swallowed. */
    complete({
      method: "Razorpay",
      reference: result.reason === "dismissed" ? "Closed before completing" : "Declined",
      outcome: "failed",
      note: result.message,
    });
  }, [
    commitNewAddress,
    complete,
    coupon,
    draft,
    empty,
    focusFirstError,
    itemCount,
    onClose,
    payable,
    scrollToTop,
  ]);

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
      if (step.id === "address") commitNewAddress();
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
      <div className="co-load" role="status">
        <Loader2 aria-hidden className="co-spin" size={16} />
        Writing your order…
      </div>
    );
  }

  /* The bag is restored after mount, so the first paint of a statically
     exported page has nothing in it. Judging it that early paints "your bag is
     empty" over a bag that is about to arrive. */
  if (!hydrated) {
    return (
      <div className="co-load" role="status">
        Opening your bag…
      </div>
    );
  }

  /* The bag can empty while this is open — another tab, or the last line
     removed behind it — so the surface has to answer for that rather than
     render a checkout for nothing. */
  if (empty) {
    return (
      <div className="io-empty">
        <div className="io-empty__copy">
          <span className="io-empty__glyph">
            <ShoppingBag aria-hidden size={20} strokeWidth={1.4} />
          </span>
          <h2>Your bag is empty.</h2>
          <p>Add a piece from the current drop and it will be held here with its size.</p>
        </div>
        <Link className="io-btn io-btn--solid" href="/new-drop" onClick={onClose}>
          Shop the drop
          <ArrowRight aria-hidden size={15} />
        </Link>
      </div>
    );
  }

  const StepIcon = step.icon;

  /* ----------------------------------------------------------------- body */

  return (
    <>
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
              {/* Read first, edit on request.
                  These three arrive from the account and are usually right, and
                  three open text inputs are three invitations to check something
                  that needs no checking. So they are shown as WHAT THEY ARE —
                  the details this order will be confirmed to — and turn back
                  into fields when the shopper asks, or on their own the moment
                  one of them is missing or malformed, since there is nothing to
                  read in that case and something to fix. */}
              {step.id === "contact" && (
                <>
                  {contactReadable ? (
                    <div className="co-read">
                      <div className="co-read__item co-read__item--wide">
                        <span>Full name</span>
                        <strong>{draft.name}</strong>
                      </div>
                      <div className="co-read__item">
                        <span>Email</span>
                        <strong>{draft.email}</strong>
                      </div>
                      <div className="co-read__item">
                        <span>Mobile</span>
                        <strong>{draft.mobile}</strong>
                      </div>
                      <button
                        className="co-read__edit"
                        onClick={() => setEditingContact(true)}
                        type="button"
                      >
                        <Pencil aria-hidden size={12} strokeWidth={1.8} />
                        Edit
                      </button>
                    </div>
                  ) : (
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
                  )}

                  {/* Only offered while the three are actually readable back —
                      a "done" on a half-filled form is a button that refuses. */}
                  {editingContact && contactClean && (
                    <button
                      className="io-btn io-btn--ghost io-btn--sm co-read__done"
                      onClick={() => setEditingContact(false)}
                      type="button"
                    >
                      <Check aria-hidden size={14} strokeWidth={2} />
                      Done
                    </button>
                  )}
                </>
              )}

              {/* ---------------------------------------------------- 02 address */}
              {step.id === "address" && (
                <>
                  {/* The book, then a way past it. "Add new address" is a chip in
                      the same row rather than a link somewhere else, because it
                      is the same decision — which destination — and one of the
                      answers happens to not exist yet. */}
                  <div className="co-saved">
                    <p className="co-saved__label">Deliver to</p>
                    <div className="co-saved__list">
                      {addresses.map((address) => (
                        <button
                          className="co-saved__chip"
                          data-selected={
                            (!addingAddress && address.id === selectedAddressId) || undefined
                          }
                          key={address.id}
                          onClick={() => pickSavedAddress(address)}
                          type="button"
                        >
                          <MapPin aria-hidden size={13} strokeWidth={1.8} />
                          <span>
                            <strong>{address.label}</strong>
                            <small>{addressSummary(address)}</small>
                          </span>
                        </button>
                      ))}

                      <button
                        className="co-saved__chip co-saved__chip--new"
                        data-selected={addingAddress || undefined}
                        onClick={startNewAddress}
                        type="button"
                      >
                        <Plus aria-hidden size={13} strokeWidth={2} />
                        <span>
                          <strong>Add new address</strong>
                          <small>Deliver this order somewhere else</small>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="co-fields">
                    {addingAddress && (
                      <Field
                        field="addressLabel"
                        label="Save as"
                        onChange={setAddressLabel}
                        placeholder="Home, Studio, Parents…"
                        value={addressLabel}
                        wide
                      />
                    )}
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
                    {/* State first, then city: the city list is the state's, and
                        asking for a city before knowing the state is how
                        "Bengaluru, Maharashtra" gets typed and shipped. */}
                    <RegionField
                      emptyLabel="No state by that name."
                      error={errors.state}
                      id={fieldId("state")}
                      label="State"
                      onChange={setStateField}
                      options={withCurrent(INDIAN_STATES, draft.state)}
                      placeholder="Select state"
                      searchPlaceholder="Search states…"
                      value={draft.state}
                    />
                    <RegionField
                      disabled={draft.state.trim().length === 0}
                      emptyLabel="No city by that name in this state."
                      error={errors.city}
                      id={fieldId("city")}
                      label="City"
                      onChange={(value) => setField("city", value)}
                      options={withCurrent(citiesOf(draft.state), draft.city)}
                      placeholder={draft.state ? "Select city" : "State first"}
                      searchPlaceholder="Search cities…"
                      value={draft.city}
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

                  {addingAddress && (
                    <label className="io-check">
                      <input
                        checked={saveAddress}
                        onChange={(event) => setSaveAddress(event.target.checked)}
                        type="checkbox"
                      />
                      <span>Save this address to my account</span>
                    </label>
                  )}
                </>
              )}

              {/* ------------------------------------------ 03 delivery & payment */}
              {/* No review block. The two answers behind this step are already on
                  the rail above it, one line each, with a press to go back and
                  change either — quoting them again in full is the same screen
                  asking the shopper to read their own address for a third time. */}
              {step.id === "payment" && (
                <>
                  {/* Two speeds, side by side: a pair of full-width bars reads as
                      a list to scroll, two halves as a choice to make. */}
                  <div className="co-group">
                    <p className="co-group__label">Delivery speed</p>
                    <div className="co-choices co-choices--split">
                      {DELIVERY_OPTIONS.map((option) => {
                        const Icon = DELIVERY_ICONS[option.id];
                        const fee = deliveryFee(option.id, subtotal);
                        const selected = draft.deliveryMethod === option.id;

                        return (
                          <label
                            className="co-choice"
                            data-selected={selected || undefined}
                            key={option.id}
                          >
                            <input
                              checked={selected}
                              disabled={status === "paying"}
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
                              <small>{option.window}</small>
                            </span>
                            <span className="co-choice__price">
                              {fee === 0 ? "Free" : formatPrice(fee)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="co-group">
                    <p className="co-group__label">Payment method</p>
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
                      The card is asked for when you press checkout, not here — it is checked in
                      this browser, never saved, and only the brand and last four digits reach the
                      order.
                    </p>
                  )}

                  {draft.paymentMethod === "razorpay" && (
                    <>
                      <p className="co-card__foot">
                        <Lock aria-hidden size={12} strokeWidth={1.8} />
                        Razorpay opens its own secure frame over this page when you press checkout.
                        No card number, UPI PIN or CVV is entered on this site, and the order is
                        placed only once the gateway answers.
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

                {/* CONTINUE, and only continue.
                    The last step has no button of its own: the summary beside
                    it already carries the one that finishes the order, and two
                    controls for one irreversible action — at different prices
                    of attention, on the same screen — is a choice nobody asked
                    to make. The form still submits on Enter, and still ends up
                    in `payAndPlace`. */}
                {!isLast && (
                  <button
                    className="io-btn io-btn--solid"
                    disabled={status === "paying"}
                    type="submit"
                  >
                    Continue
                    <ArrowRight aria-hidden size={15} />
                  </button>
                )}
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

              {/* The first few, whole. A summary is read against the total beside
                  it, and a list that hides its own end inside a 268px scroller is
                  the one shape that cannot be — so the rest go to a surface that
                  shows them all at once instead of a gesture that reveals them
                  one at a time. */}
              <ul className="co-summary__lines">
                {lines.slice(0, SUMMARY_LINES).map((line) => (
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

              {lines.length > SUMMARY_LINES && (
                <button className="co-summary__more" onClick={() => setBagOpen(true)} type="button">
                  See all {lines.length} lines
                  <ChevronDown aria-hidden size={14} strokeWidth={1.8} />
                </button>
              )}

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
                  the first two steps, a returning shopper's checkout is
                  genuinely one press — and pressing it early is not an error:
                  it runs the whole form, and if something really is missing it
                  opens the step that is missing it instead of refusing.

                  It says CHECKOUT whatever the method is. What happens next is
                  the method's business — the gateway's frame, the card sheet, or
                  straight to the order — and a button that renames itself three
                  ways for one action is three things to read instead of one. */}
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
                ) : (
                  <>
                    Checkout · {formatPrice(payable)}
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

      <BagDialog
        itemCount={itemCount}
        lines={lines}
        onOpenChange={setBagOpen}
        open={bagOpen}
        subtotal={subtotal}
      />

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
    </>
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

