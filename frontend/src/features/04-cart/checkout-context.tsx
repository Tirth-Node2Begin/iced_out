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
import { useAuth } from "@/features/20-auth-security/auth-context";

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

/**
 * WHOSE draft is in `DRAFT_KEY` — the account's email, or "" for a guest.
 *
 * A draft holds a name, an email and a phone number, and those belong to a
 * PERSON rather than to a browser. Without this the details simply stayed:
 * one shopper checked out, signed out, and the next person to register on the
 * same machine opened a checkout already filled in with the first one's name
 * and email — and, unless they noticed, would have had their confirmation sent
 * there. Unlike the bag, this is not a convenience worth leaking.
 */
const OWNER_KEY = "iced-out.checkout.owner";

function readOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/**
 * Drop the stored draft NOW, rather than trusting the write-back effect below
 * to overwrite it.
 *
 * That trust was misplaced and cost a round of this fix: `setDraft(initialDraft)`
 * when the state is ALREADY `initialDraft` hands React the same reference, so
 * there is nothing to re-render and the effect that persists the draft need
 * never run. The owner had been recorded by then, so the next load saw a
 * matching owner, adopted the stale draft as the new shopper's, and the leak
 * survived its own fix. Deleting the key here is unconditional and immediate.
 */
function clearStoredDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing stored means nothing to leak */
  }
}

function writeOwner(identity: string) {
  try {
    window.localStorage.setItem(OWNER_KEY, identity);
  } catch {
    /* the draft simply lasts as long as the tab */
  }
}

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
  const { customer, sessionReady } = useAuth();
  const [draft, setDraft] = useState(initialDraft);
  const [restored, setRestored] = useState(false);

  /** The signed-in shopper, or "" while nobody is. See `OWNER_KEY`. */
  const identity = customer?.email ?? "";

  /**
   * Whose draft is in storage, decided the moment the answer can change.
   *
   * This is React's "adjust state when something changes" pattern rather than an
   * effect, and the difference is not cosmetic: a setState in an effect body
   * paints the OLD draft for one frame and then replaces it, which on this
   * screen means a signed-in shopper sees somebody else's address flash before
   * it is cleared. Adjusting during render means the first paint is already
   * right — and it is why `setState`-in-effect is an error in this repo.
   *
   * `sessionReady` gates it because the app is exported as static HTML with
   * nobody signed in: acting on the first render would judge every draft
   * against an empty identity.
   */
  const [seenIdentity, setSeenIdentity] = useState<string | null>(null);

  if (sessionReady && seenIdentity !== identity) {
    const owner = readOwner();

    /* The draft is kept only where it can be shown to be this shopper's:
     *
     *   · the recorded owner IS them;
     *   · or a GUEST typed it and has since signed in — the same person, and
     *     clearing the form under them would be this very bug pointed the
     *     other way;
     *   · or nobody is signed in and nobody ever was.
     *
     * Everything else is somebody else's: another account, a sign-out, or —
     * the case that matters on the day this ships — a draft written before
     * ownership was recorded at all, whose provenance cannot be established.
     * An unknown draft is treated as not-yours rather than assumed-yours,
     * which costs a signed-in shopper one re-typed address at upgrade and
     * closes the leak for everybody already carrying one.
     */
    const mine =
      owner === identity ||
      (owner === "" && identity !== "") ||
      (owner === null && identity === "");

    setSeenIdentity(identity);
    setDraft(mine ? readDraft() : initialDraft);
    setRestored(true);
  }

  /**
   * The two STORAGE writes that go with the decision above.
   *
   * They stay in an effect because they mutate something outside React, which
   * a render must never do — and they are ordered: the stored draft is cleared
   * BEFORE the owner is recorded, so a failure between the two leaves an
   * unowned draft (which the rule above treats as not-yours) rather than
   * somebody else's draft stamped as yours.
   */
  useEffect(() => {
    if (!sessionReady) return;

    const owner = readOwner();
    const mine =
      owner === identity ||
      (owner === "" && identity !== "") ||
      (owner === null && identity === "");

    if (!mine) clearStoredDraft();
    writeOwner(identity);
  }, [identity, sessionReady]);

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
