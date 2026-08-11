/**
 * Razorpay Checkout, in test mode.
 *
 * Razorpay rather than a card form of our own: no card number, CVV or expiry
 * ever touches this origin — the gateway opens its own frame, takes the detail
 * and hands back an id. That is also why there is nothing to "validate" here.
 *
 * There is no server in this build (`output: "export"`), so this uses the
 * amount-only checkout rather than the server-created `order_id` flow. In test
 * mode that is enough to open the real gateway and complete a real test
 * payment. A production build MUST create the order server-side and verify
 * `razorpay_signature` before trusting anything below — the handler payload is
 * a claim made by the browser until a server has checked it.
 *
 * Test cards: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.
 * Test UPI: `success@razorpay`.
 */

const SDK_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/* ---------------------------------------------------------------------------
   CONFIGURATION — the two placeholders a real deployment replaces

   Nothing below is a secret. `key_id` is public by design (it is read out of
   the page source on every Razorpay checkout in existence); the `key_secret`
   that pairs with it belongs on a server this build does not have, which is
   why the two server-side steps are stubs rather than half-written client code
   that would have to leak it.

   1. NEXT_PUBLIC_RAZORPAY_KEY_ID   — the live/test key, dropped in `.env.local`
   2. NEXT_PUBLIC_RAZORPAY_ORDER_API — the endpoint that creates a Razorpay
      order server-side and returns `{ id: "order_..." }`, plus (later) the
      endpoint that verifies `razorpay_signature` after payment.

   Until (2) exists this uses the amount-only checkout, which opens the real
   gateway and completes a real test payment but produces a result that is a
   CLAIM MADE BY THE BROWSER. Treat it as decoration on a receipt, never as
   proof of money, until a server has checked the signature.
   ------------------------------------------------------------------------ */

/** Razorpay's own documented public test key — overridable per deployment. */
export const RAZORPAY_KEY_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "rzp_test_1DP5mmOlF5G5ag";

/** Unset until the payments API is handed over. See `createGatewayOrder`. */
export const RAZORPAY_ORDER_API = process.env.NEXT_PUBLIC_RAZORPAY_ORDER_API ?? "";

export const IS_TEST_KEY = RAZORPAY_KEY_ID.startsWith("rzp_test");

/**
 * The server-created order id, once there is a server to ask.
 *
 * Placeholder on purpose: with `RAZORPAY_ORDER_API` unset it resolves to null
 * and the caller falls back to the amount-only flow, so the checkout works
 * today and gains the correct flow the moment the endpoint exists — no other
 * file changes. A failure here also resolves to null rather than throwing: an
 * order-creation endpoint that is down should degrade to a payment that still
 * opens, not to a checkout that cannot be reached.
 */
export async function createGatewayOrder(request: PaymentRequest): Promise<string | null> {
  if (!RAZORPAY_ORDER_API) return null;

  try {
    const response = await fetch(RAZORPAY_ORDER_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100),
        currency: "INR",
        notes: request.notes ?? {},
      }),
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    const id = (payload as { id?: unknown } | null)?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

type RazorpayResponse = {
  razorpay_payment_id: string;
  /** Present only on the server-created-order flow. */
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

type RazorpayFailure = { error?: { description?: string; reason?: string } };

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  /** Omitted until `createGatewayOrder` has an endpoint to create one with. */
  order_id?: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  notes: Record<string, string>;
  theme: { color: string; backdrop_color?: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/**
 * How long to wait for the gateway script before giving up.
 *
 * A `<script>` that is merely SLOW — a captive portal, a dead DNS answer, an
 * offline laptop — fires neither `load` nor `error`, sometimes for minutes.
 * Without this the pay button sits on "waiting for the gateway" forever with
 * no way back. A refusal the shopper can act on beats a spinner that never
 * resolves.
 */
const LOAD_TIMEOUT_MS = 12_000;

let loader: Promise<boolean> | null = null;

/** Injects the gateway script once per page, however many attempts are made. */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loader) return loader;

  loader = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing ?? document.createElement("script");

    const settle = (ready: boolean) => {
      window.clearTimeout(timer);
      // A failed load is never cached as a permanent verdict — offline for one
      // attempt is not offline for the next, and the shopper can press again.
      if (!ready) loader = null;
      resolve(ready);
    };

    const timer = window.setTimeout(() => settle(Boolean(window.Razorpay)), LOAD_TIMEOUT_MS);

    script.addEventListener("load", () => settle(Boolean(window.Razorpay)));
    script.addEventListener("error", () => settle(false));

    if (!existing) {
      script.src = SDK_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return loader;
}

export type PaymentResult =
  | { ok: true; paymentId: string; orderId?: string; signature?: string }
  | { ok: false; reason: "unavailable" | "dismissed" | "failed"; message: string };

export type PaymentRequest = {
  /** rupees — converted to the paise the gateway expects */
  amount: number;
  description: string;
  customer: { name: string; email: string; contact: string };
  notes?: Record<string, string>;
};

/**
 * Opens the gateway and settles once, whichever way it ends.
 *
 * Three outcomes reach the caller and they are deliberately distinct: paid,
 * closed by the shopper, refused by the gateway. Collapsing "dismissed" into
 * "failed" is how a checkout ends up showing a payment error to someone who
 * simply pressed Escape.
 */
export function openRazorpayCheckout(request: PaymentRequest): Promise<PaymentResult> {
  /* Both are asked for at once: the script is a network round trip and so is
     the order, and running them in series would add the slower one to the wait
     before the gateway appears. Order creation cannot fail the payment — it
     resolves to null and the amount-only flow takes over. */
  return Promise.all([loadRazorpay(), createGatewayOrder(request)]).then(([ready, orderId]) => {
    const Razorpay = window.Razorpay;
    if (!ready || !Razorpay) {
      return {
        ok: false,
        reason: "unavailable",
        message: "The payment gateway could not be reached. Check the connection and try again.",
      } satisfies PaymentResult;
    }

    return new Promise<PaymentResult>((resolve) => {
      let settled = false;
      const settle = (result: PaymentResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const checkout = new Razorpay({
        key: RAZORPAY_KEY_ID,
        // Razorpay counts in the smallest currency unit; every price in this
        // app is whole rupees, so this is the only place paise exist.
        amount: Math.round(request.amount * 100),
        currency: "INR",
        ...(orderId ? { order_id: orderId } : {}),
        name: "Iced_out",
        description: request.description,
        prefill: request.customer,
        notes: request.notes ?? {},
        theme: { color: "#f2f4f4", backdrop_color: "#101113" },
        handler: (response) =>
          settle({
            ok: true,
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            // Carried, not trusted. The verify endpoint that will check it is
            // the other half of the placeholder above.
            signature: response.razorpay_signature,
          }),
        modal: {
          ondismiss: () =>
            settle({
              ok: false,
              reason: "dismissed",
              message: "Payment was closed before it completed. Nothing has been charged.",
            }),
        },
      });

      checkout.on("payment.failed", (response) =>
        settle({
          ok: false,
          reason: "failed",
          message:
            response.error?.description ??
            "The gateway declined this payment. Nothing has been charged.",
        }),
      );

      checkout.open();
    });
  });
}
