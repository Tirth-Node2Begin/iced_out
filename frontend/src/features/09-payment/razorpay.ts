/**
 * Razorpay Checkout.
 *
 * Razorpay rather than a card form of our own: no card number, CVV or expiry
 * ever touches this origin — the gateway opens its own frame, takes the detail
 * and hands back an id. That is also why there is nothing to "validate" here.
 *
 * The two steps that CANNOT happen in a browser happen on the API, because both
 * need the key secret (see `backend/src/Integration/Payments/RazorpayGateway`):
 *
 *   1. the order is created server-side, so the amount is stated by the server
 *      before the shopper is shown a gateway and cannot be edited from the
 *      console of the page paying it;
 *   2. `razorpay_signature` is verified server-side afterwards, because until
 *      it is, `razorpay_payment_id` is A STRING A BROWSER SENT.
 *
 * Both degrade rather than break. An API that cannot be reached for step 1
 * leaves `order` null and the amount-only checkout takes over — the real
 * gateway still opens and still takes a real payment; what is lost is the
 * ability to CHECK the result, which step 2 then reports honestly as
 * `verified: false` rather than pretending.
 *
 * Test cards: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.
 * Test UPI: `success@razorpay`.
 */

import { customerClient } from "@/api/clients";
import { peekStorefrontConfig } from "@/features/04-cart/storefront-config";

const SDK_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/* ---------------------------------------------------------------------------
   THE KEY

   `key_id` is public by design — it is read out of the page source on every
   Razorpay checkout in existence — so it may be baked into the bundle or served
   by the API, and both are supported:

     NEXT_PUBLIC_RAZORPAY_KEY_ID   frontend/.env.local, baked in at build time
     GET /config/storefront        `razorpay_key_id`, from backend/.env

   The env var wins where it is set, so a preview deployment can point at a
   different Razorpay account without touching the API. Neither is a fallback
   for a MISSING key: there is deliberately no built-in default. The one that
   used to be here — Razorpay's old published demo key — is an account with
   every payment method switched off, and a checkout opened against it dies on
   "No appropriate payment method found" no matter what the shopper picks.
   Refusing with a sentence beats opening a gateway that cannot take money.
   ------------------------------------------------------------------------ */

/** The configured public key, or "" while nothing has configured one. */
export function razorpayKeyId(): string {
  // `||`, not `??`: an env var left blank in `.env.local` is not a key, and
  // must fall through to the API rather than shadow it with "".
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || peekStorefrontConfig().razorpayKeyId;
}

/** Whether a key belongs to a test account — what the test-card hint keys off. */
export function isTestKey(key: string = razorpayKeyId()): boolean {
  return key.startsWith("rzp_test");
}

type GatewayOrder = {
  /** `order_...` */
  id: string;
  /** Paise, as the gateway counts — echoed back so the two figures cannot drift. */
  amount: number;
  currency: string;
  /**
   * The public key of the account this order was created under.
   *
   * Preferred over the configured one for exactly one reason: an `order_id`
   * from one account opened with a `key_id` from another is refused by the
   * gateway in ways that read as "no payment method available", which sends
   * everyone looking at their method settings instead of their keys.
   */
  keyId: string;
};

/**
 * The server-created order — null when the API cannot make one.
 *
 * Null rather than a throw, at every failure: an order endpoint that is down,
 * a session that has expired, a server with no Razorpay credentials. All of
 * them should degrade to a payment that still opens, not to a checkout that
 * cannot be reached.
 */
export async function createGatewayOrder(request: PaymentRequest): Promise<GatewayOrder | null> {
  try {
    const response = await customerClient.post<{ data: Partial<GatewayOrder> & { key_id?: string } }>(
      "/checkout/payments/razorpay/order",
      {
        // Rupees. Paise are the gateway's unit and exist only inside it and the
        // one server call that speaks to it.
        amount: Math.round(request.amount),
        receipt: request.notes?.order ?? "iced-out",
        notes: request.notes ?? {},
      },
    );

    const payload = response.data.data ?? {};

    return typeof payload.id === "string" && payload.id.length > 0
      ? {
          id: payload.id,
          amount: typeof payload.amount === "number" ? payload.amount : Math.round(request.amount * 100),
          currency: payload.currency ?? "INR",
          keyId: payload.key_id ?? "",
        }
      : null;
  } catch {
    return null;
  }
}

/**
 * Does this payment really belong to this order?
 *
 * Three answers, and they are deliberately distinct:
 *   true   the signature checks out against the secret
 *   false  it does not — a payment id that was not made for this order
 *   null   the question could not be put (no order, no signature, API down)
 *
 * Collapsing null into false would refuse money that was genuinely taken every
 * time the network hiccupped in the second after a card cleared.
 */
async function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean | null> {
  try {
    const response = await customerClient.post<{ data: { verified?: boolean } }>(
      "/checkout/payments/razorpay/verify",
      { orderId, paymentId, signature },
    );

    const verified = response.data.data?.verified;

    return typeof verified === "boolean" ? verified : null;
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
  /** Omitted when the API could not create one — see `createGatewayOrder`. */
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
  | {
      ok: true;
      paymentId: string;
      orderId?: string;
      signature?: string;
      /**
       * True only when the API checked the signature against the secret and
       * agreed. False covers both "there was no server-created order to check
       * against" and "the check could not be reached" — money that moved, on a
       * receipt nothing has corroborated.
       */
      verified: boolean;
    }
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
 * Four outcomes reach the caller and they are deliberately distinct: paid,
 * closed by the shopper, refused by the gateway, gateway never available.
 * Collapsing "dismissed" into "failed" is how a checkout ends up showing a
 * payment error to someone who simply pressed Escape.
 */
export function openRazorpayCheckout(request: PaymentRequest): Promise<PaymentResult> {
  /* Both are asked for at once: the script is a network round trip and so is
     the order, and running them in series would add the slower one to the wait
     before the gateway appears. Order creation cannot fail the payment — it
     resolves to null and the amount-only flow takes over. */
  return Promise.all([loadRazorpay(), createGatewayOrder(request)]).then(([ready, order]) => {
    const Razorpay = window.Razorpay;

    if (!ready || !Razorpay) {
      return {
        ok: false,
        reason: "unavailable",
        message: "The payment gateway could not be reached. Check the connection and try again.",
      } satisfies PaymentResult;
    }

    // The order's own account first — see `GatewayOrder.keyId`.
    const key = order?.keyId || razorpayKeyId();

    if (!key) {
      return {
        ok: false,
        reason: "unavailable",
        message:
          "Card payments are not configured for this store yet. Choose cash on delivery, or try again later.",
      } satisfies PaymentResult;
    }

    return new Promise<PaymentResult>((resolve) => {
      let settled = false;
      const settle = (result: PaymentResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      /**
       * Raised the instant the gateway says paid, before anything is awaited.
       *
       * The success handler is no longer synchronous — it goes back to the API
       * to have the signature checked — and Razorpay closes its frame as soon
       * as it has called it. `ondismiss` fires on that close, which without
       * this would land in the gap and settle a PAID checkout as "closed before
       * it completed": the shopper charged, the order recorded as abandoned.
       */
      let paid = false;

      const checkout = new Razorpay({
        key,
        // Razorpay counts in the smallest currency unit; every price in this
        // app is whole rupees, so this is the only place paise exist in the
        // browser. On the server-order flow the gateway's own figure is used,
        // because it is the one the payment will be checked against.
        amount: order?.amount ?? Math.round(request.amount * 100),
        currency: order?.currency ?? "INR",
        ...(order ? { order_id: order.id } : {}),
        name: "Iced_out",
        description: request.description,
        prefill: request.customer,
        notes: request.notes ?? {},
        theme: { color: "#f2f4f4", backdrop_color: "#101113" },
        handler: (response) => {
          paid = true;

          const orderId = response.razorpay_order_id ?? order?.id ?? "";
          const signature = response.razorpay_signature ?? "";

          /* Nothing to check against on the amount-only flow, so it settles
             immediately and says so. The frame has already closed by now; the
             shopper is looking at the order screen either way. */
          if (orderId === "" || signature === "") {
            settle({
              ok: true,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              verified: false,
            });
            return;
          }

          void verifyPayment(orderId, response.razorpay_payment_id, signature).then((verified) => {
            /* An explicit NO is the one case that is not a payment. A signature
               that does not match the secret means this payment id was not made
               for this order, and recording it would put money on the books
               that the gateway does not have. `null` — the check could not be
               reached — is not that, and is not treated as it. */
            if (verified === false) {
              settle({
                ok: false,
                reason: "failed",
                message:
                  "The gateway's confirmation could not be verified, so nothing has been recorded as paid. If you were charged, it will be released automatically.",
              });
              return;
            }

            settle({
              ok: true,
              paymentId: response.razorpay_payment_id,
              orderId,
              signature,
              verified: verified === true,
            });
          });
        },
        modal: {
          ondismiss: () => {
            // The frame closing on its way OUT of a successful payment is not
            // a dismissal — see `paid`.
            if (paid) return;

            settle({
              ok: false,
              reason: "dismissed",
              message: "Payment was closed before it completed. Nothing has been charged.",
            });
          },
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
