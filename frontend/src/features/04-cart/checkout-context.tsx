"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { DeliveryMethod } from "@/features/04-cart/delivery-options";

/**
 * What the shopper typed on the way to paying.
 *
 * It is remembered between page loads for the same reason the bag is: checkout
 * is two screens, and a reload on the payment screen used to send someone back
 * to an empty address form with their bag still full. Nothing sensitive lives
 * here — a name, a destination and which of two delivery speeds. No card
 * detail ever reaches this app, let alone this key.
 */
export type PaymentMethod = "razorpay" | "card" | "cod";

export const PAYMENT_METHODS: PaymentMethod[] = ["cod", "card", "razorpay"];

export type CheckoutDraft = {
  name: string;
  email: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
};

const DRAFT_KEY = "iced-out.checkout";

const initialDraft: CheckoutDraft = {
  name: "",
  email: "",
  mobile: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  deliveryMethod: "standard",
  paymentMethod: "cod",
};

/* What makes a draft complete is no longer a list of non-empty strings — see
   `checkout-validation.ts`, which is the one place that decides what checkout
   will and will not accept, for the rail, the step and the order alike. */

function readDraft(): CheckoutDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return initialDraft;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return initialDraft;

    // Field by field against the initial shape — a hand-edited key cannot put
    // a number where an input expects a string and break the form on boot.
    const stored = parsed as Partial<Record<keyof CheckoutDraft, unknown>>;
    const draft = { ...initialDraft };
    for (const key of Object.keys(initialDraft) as Array<keyof CheckoutDraft>) {
      const value = stored[key];
      if (typeof value === "string") draft[key] = value as never;
    }

    /* The two enum fields drive a `switch` and a radio group, so a string that
       is merely a string is not enough — a stale `"upi"` left by an older build
       would render a payment step with nothing selected and no way to submit. */
    if (draft.deliveryMethod !== "standard" && draft.deliveryMethod !== "express") {
      draft.deliveryMethod = initialDraft.deliveryMethod;
    }
    if (!PAYMENT_METHODS.includes(draft.paymentMethod)) {
      draft.paymentMethod = initialDraft.paymentMethod;
    }

    return draft;
  } catch {
    return initialDraft;
  }
}

type CheckoutContextValue = {
  draft: CheckoutDraft;
  /** false until storage has been read — nothing should judge the draft before */
  restored: boolean;
  updateDraft: (patch: Partial<CheckoutDraft>) => void;
  /** wipes the destination once an order carries it, keeping contact details */
  resetDraft: () => void;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(initialDraft);
  const [restored, setRestored] = useState(false);

  /* Read after mount, never during render: this app is exported as static HTML
     and the markup React hydrates was written with an empty draft in it. */
  useEffect(() => {
    setDraft(readDraft());
    setRestored(true);
  }, []);

  /* `restored` stops the first render writing its empty state over the stored
     draft — without it the read above would always come back with nothing. */
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* the draft simply lasts as long as the tab */
    }
  }, [draft, restored]);

  const updateDraft = useCallback((patch: Partial<CheckoutDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraft((current) => ({
      ...initialDraft,
      // Who you are survives an order; where this one went does not, because
      // the next one may not go to the same place.
      name: current.name,
      email: current.email,
      mobile: current.mobile,
    }));
  }, []);

  const value = useMemo(
    () => ({ draft, restored, updateDraft, resetDraft }),
    [draft, resetDraft, restored, updateDraft],
  );

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) throw new Error("useCheckout must be used inside CheckoutProvider");
  return context;
}
