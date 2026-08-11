"use client";

import {
  ArrowRight,
  Check,
  CircleDashed,
  CircleX,
  CreditCard,
  LifeBuoy,
  Loader2,
  MapPin,
  PackageCheck,
  PackageSearch,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TriangleAlert,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { formatPrice } from "@/features/02-products";
import { useOrders } from "@/features/07-orders/orders-context";
import { openRazorpayCheckout } from "@/features/09-payment/razorpay";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * One order, from both directions.
 *
 * It is the screen a payment lands on AND the screen the profile archive opens,
 * which is deliberate — a "thank you" page that is not the order is a page that
 * can only ever be seen once, and everything on it has to be rebuilt somewhere
 * durable anyway. So the record is the page, and the thanks is a banner the
 * record wears for the one visit that follows a payment.
 */
export function CustomerOrderDetail({ orderId }: { orderId: string }) {
  const hydrated = useHydrated();
  const { findOrder, restored, settlePayment } = useOrders();
  const [showCancellation, setShowCancellation] = useState(false);
  const [requestReady, setRequestReady] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const order = findOrder(orderId);

  /* The thanks rides in the URL rather than in a flag somewhere that has to be
     cleared: payment lands on `?placed=1`, and the same order opened from the
     archive later has no query on it and is simply the record. Nothing to
     reset, and nothing that can get stuck congratulating an old purchase. */
  const arrived = useSearchParams().get("placed");

  /* Local orders are read out of storage after mount, so an id that is not a
     fixture cannot be judged missing until that read has happened. */
  if (!hydrated || !restored) {
    return (
      <div className="co-load" role="status">
        Opening your order…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="io-empty">
        <div className="io-empty__copy">
          <span className="io-empty__glyph">
            <PackageSearch aria-hidden size={20} strokeWidth={1.4} />
          </span>
          <h2>That order is not on this device.</h2>
          <p>
            Orders placed here are kept in this browser. Signing out or clearing site data
            clears them with it.
          </p>
        </div>
        <Link className="io-btn io-btn--solid" href="/account/orders">
          All orders
          <ArrowRight aria-hidden size={15} />
        </Link>
      </div>
    );
  }

  const delivered = order.status === "Delivered";
  const firstName = order.contact?.name.trim().split(/\s+/)[0];
  const returnable = order.lines.some((line) => line.returnEligible);

  /* Unpaid is a property of the RECORD, not of how this screen was arrived at.
     `?placed=…` only decides whether the shopper is seeing the outcome for the
     first time; an order whose payment failed says so every time it is opened,
     until it is paid. */
  const unpaid = order.payment.status === "Failed";
  const celebrate = arrived === "1" && !unpaid;

  async function retryPayment() {
    if (!order?.money) return;

    setRetryError(null);
    setRetrying(true);

    const result = await openRazorpayCheckout({
      amount: order.money.total,
      description: `${order.number} · Iced_out`,
      customer: {
        name: order.contact?.name ?? "",
        email: order.contact?.email ?? "",
        contact: order.contact?.mobile ?? "",
      },
      notes: { order: order.number, attempt: "retry" },
    });

    setRetrying(false);

    if (result.ok) {
      settlePayment(order.id, {
        method: "Razorpay · Card / UPI / Netbanking",
        reference: result.paymentId,
        outcome: "captured",
      });
      return;
    }

    /* A second failure rewrites nothing. The order is already recorded as
       unpaid and re-saving that would only churn storage; what is new is the
       reason, and that belongs on screen rather than in the record. */
    setRetryError(result.message);
  }

  function previewCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestReady(true);
  }

  return (
    <div className="io-sec__body">
      {/* --------------------------------------------------------- the thanks */}
      {unpaid ? (
        /* The same block as the thank-you, inverted. It is deliberately the
           SAME block: an order that failed to pay is not a smaller event than
           one that succeeded, and burying it in a strip of red text above a
           cheerful receipt is how someone closes the tab believing they have
           bought something. */
        <section className="od-thanks od-thanks--failed">
          <span aria-hidden className="od-thanks__mark">
            <CircleX size={26} strokeWidth={2.2} />
          </span>
          <p className="od-thanks__eyebrow">
            <TriangleAlert aria-hidden size={12} strokeWidth={1.8} />
            Payment unsuccessful
          </p>
          <h2 className="od-thanks__title">
            {arrived === "0" ? (
              <>That payment did not go through. <em>Nothing was charged.</em></>
            ) : (
              <>{order.number} is <em>waiting on payment.</em></>
            )}
          </h2>
          <p className="od-thanks__copy">
            {order.payment.note ?? "The gateway did not confirm this payment."} Your order is
            held exactly as it was — nothing has left your account, and nothing ships until the
            payment clears.
          </p>

          <dl className="od-thanks__spec">
            <div>
              <dt>Order</dt>
              <dd>{order.number}</dd>
            </div>
            <div>
              <dt>Amount due</dt>
              <dd>{order.total}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Unpaid</dd>
            </div>
          </dl>

          {retryError && (
            <div className="co-alert od-thanks__alert" role="alert">
              <TriangleAlert aria-hidden size={16} strokeWidth={1.7} />
              <p>
                <strong>That attempt did not complete either</strong>
                {retryError}
              </p>
            </div>
          )}

          <div className="od-thanks__actions">
            <button
              className="io-btn io-btn--solid"
              disabled={retrying || !order.money}
              onClick={retryPayment}
              type="button"
            >
              {retrying ? (
                <>
                  <Loader2 aria-hidden className="co-spin" size={15} />
                  Waiting for the gateway…
                </>
              ) : (
                <>
                  <RefreshCw aria-hidden size={15} strokeWidth={1.7} />
                  Retry payment · {order.total}
                </>
              )}
            </button>
            <Link className="io-btn io-btn--ghost" href="/account/support">
              <LifeBuoy aria-hidden size={15} strokeWidth={1.7} />
              Get support
            </Link>
            <Link className="io-btn io-btn--ghost" href="/new-drop">
              <ShoppingBag aria-hidden size={15} strokeWidth={1.7} />
              Keep shopping
            </Link>
          </div>
        </section>
      ) : celebrate ? (
        <section className="od-thanks">
          <span aria-hidden className="od-thanks__mark">
            <Check size={26} strokeWidth={2.2} />
          </span>
          <p className="od-thanks__eyebrow">
            <Sparkles aria-hidden size={12} strokeWidth={1.8} />
            Order confirmed
          </p>
          <h2 className="od-thanks__title">
            Thank you{firstName ? `, ${firstName}` : ""}. <em>It is on ice.</em>
          </h2>
          <p className="od-thanks__copy">
            {order.number} is placed and{" "}
            {order.payment.status === "Captured"
              ? "the payment has been captured"
              : "the amount is due to the courier on delivery"}
            . A confirmation is on its way to {order.contact?.email ?? "your inbox"}.
          </p>

          <dl className="od-thanks__spec">
            <div>
              <dt>Order</dt>
              <dd>{order.number}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{order.total}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{order.shipment.estimate}</dd>
            </div>
          </dl>

          <div className="od-thanks__actions">
            <Link className="io-btn io-btn--solid" href="/new-drop">
              Continue shopping
              <ArrowRight aria-hidden size={15} />
            </Link>
            <Link className="io-btn io-btn--ghost" href="/account/orders">
              All orders
            </Link>
          </div>
        </section>
      ) : (
        <section className="od-head">
          <div>
            <p className="od-head__eyebrow">
              <Receipt aria-hidden size={12} strokeWidth={1.8} />
              Order record
            </p>
            <h2 className="od-head__title">{order.number}</h2>
            <p className="od-head__copy">
              Placed {order.date} · {order.items}
            </p>
          </div>
          <div className="od-head__side">
            <span className={`io-badge ${delivered ? "io-badge--ok" : "io-badge--live"}`}>
              {order.status}
            </span>
            <span className="od-head__total">{order.total}</span>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- the timeline */}
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <Truck aria-hidden size={16} strokeWidth={1.6} />
              Where it is
            </h3>
            <p className="io-panel__note">
              {unpaid
                ? "Held until the payment clears. No courier has been assigned."
                : delivered
                  ? "Delivered and closed. The return window runs from the delivery date."
                  : `Arriving ${order.shipment.estimate} · ${order.shipment.service}`}
            </p>
          </div>
          {!unpaid && order.shipment.token && (
            <Link className="io-btn io-btn--solid io-btn--sm" href={`/track/${order.shipment.token}`}>
              <Truck aria-hidden size={14} strokeWidth={1.7} />
              Track shipment
            </Link>
          )}
        </header>

        {!unpaid && order.shipment.token && (
          /* The tracking link is a token, not the order — it can be handed to
             whoever is actually waiting in for the parcel without handing them
             the account it was bought from. */
          <p className="od-token">
            <span>Tracking link</span>
            <code>/track/{order.shipment.token}</code>
            <small>Shareable · shows no name, address or payment detail</small>
          </p>
        )}

        <ol className="od-steps">
          <li data-state="done">
            <span><Check aria-hidden size={13} strokeWidth={2.4} /></span>
            <p>
              <strong>Order placed</strong>
              <small>{order.date}</small>
            </p>
          </li>
          <li
            data-state={
              order.payment.status === "Captured" ? "done" : unpaid ? "failed" : "waiting"
            }
          >
            <span>
              {order.payment.status === "Captured" ? (
                <Check aria-hidden size={13} strokeWidth={2.4} />
              ) : unpaid ? (
                <CircleX aria-hidden size={13} strokeWidth={2.2} />
              ) : (
                <CircleDashed aria-hidden size={13} strokeWidth={1.8} />
              )}
            </span>
            <p>
              <strong>
                {order.payment.status === "Captured"
                  ? "Payment captured"
                  : unpaid
                    ? "Payment failed"
                    : "Payment on delivery"}
              </strong>
              <small>{order.payment.note ?? order.payment.method}</small>
            </p>
          </li>
          <li data-state={delivered ? "done" : unpaid ? "waiting" : "current"}>
            <span><PackageCheck aria-hidden size={13} strokeWidth={1.8} /></span>
            <p>
              <strong>
                {delivered
                  ? "Dispatched"
                  : unpaid
                    ? "Waiting for payment"
                    : "Preparing to dispatch"}
              </strong>
              <small>{order.shipment.awb}</small>
            </p>
          </li>
          <li data-state={delivered ? "done" : "waiting"}>
            <span>
              {delivered ? (
                <Check aria-hidden size={13} strokeWidth={2.4} />
              ) : (
                <CircleDashed aria-hidden size={13} strokeWidth={1.8} />
              )}
            </span>
            <p>
              <strong>{delivered ? "Delivered" : "Delivery"}</strong>
              <small>{order.shipment.estimate}</small>
            </p>
          </li>
        </ol>
      </section>

      {/* ----------------------------------------------------------- the goods */}
      <div className="od-grid">
        <section className="io-panel">
          <header className="io-panel__head">
            <div>
              <h3 className="io-panel__title">
                <Receipt aria-hidden size={16} strokeWidth={1.6} />
                What you bought
              </h3>
              <p className="io-panel__note">
                Prices, names and variants are kept as they were on the day.
              </p>
            </div>
          </header>

          <ul className="od-lines">
            {order.lines.map((line) => (
              <li key={line.id}>
                <span className="od-lines__body">
                  <strong>{line.name}</strong>
                  <small>{line.variant} · Qty {line.quantity}</small>
                </span>
                <span className="od-lines__price">{line.price}</span>
              </li>
            ))}
          </ul>

          <dl className="od-totals">
            {order.money && (
              <>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(order.money.subtotal)}</dd>
                </div>
                {order.money.discount > 0 && (
                  <div className="io-off">
                    <dt>{order.money.couponCode ?? "Discount"}</dt>
                    <dd>−{formatPrice(order.money.discount)}</dd>
                  </div>
                )}
                <div>
                  <dt>Delivery</dt>
                  <dd>
                    {order.money.delivery === 0 ? "Free" : formatPrice(order.money.delivery)}
                  </dd>
                </div>
              </>
            )}
            <div className="od-totals__sum">
              <dt>Order total</dt>
              <dd>{order.total}</dd>
            </div>
          </dl>
        </section>

        <section className="io-panel">
          <header className="io-panel__head">
            <div>
              <h3 className="io-panel__title">
                <MapPin aria-hidden size={16} strokeWidth={1.6} />
                Delivery and payment
              </h3>
              <p className="io-panel__note">Where it goes, and how it was paid for.</p>
            </div>
          </header>

          {order.address && (
            <address className="co-address od-address">
              <strong>{order.contact?.name}</strong>
              <span>{order.address.line}</span>
              <span>
                {order.address.city}, {order.address.state} {order.address.postalCode}
              </span>
              {order.contact && <span>{order.contact.mobile}</span>}
            </address>
          )}

          <dl className="od-meta">
            <div>
              <dt>Service</dt>
              <dd>{order.shipment.service}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{order.shipment.destination}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>
                <CreditCard aria-hidden size={13} strokeWidth={1.7} />
                {order.payment.method}
              </dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd className="od-meta__ref">{order.payment.reference}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{order.payment.status}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ---------------------------------------------------------- the doors */}
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">Anything else?</h3>
            <p className="io-panel__note">
              Returns open once a piece is delivered. Support answers within two working days.
            </p>
          </div>
        </header>

        <div className="od-actions">
          {returnable && (
            <Link className="io-btn io-btn--ghost" href="/account/returns/new">
              <RotateCcw aria-hidden size={15} strokeWidth={1.7} />
              Start a return
            </Link>
          )}
          <Link className="io-btn io-btn--ghost" href="/account/support">
            <LifeBuoy aria-hidden size={15} strokeWidth={1.7} />
            Get support
          </Link>
          <Link className="io-btn io-btn--ghost" href="/account/orders">
            <PackageSearch aria-hidden size={15} strokeWidth={1.7} />
            All orders
          </Link>
        </div>
      </section>

      {order.cancellationEligible && !delivered && (
        <section className="io-panel io-panel--danger">
          <header className="io-panel__head">
            <div>
              <h3 className="io-panel__title">Need to cancel?</h3>
              <p className="io-panel__note">
                Cancellation stays open until the order is allocated to a courier.
              </p>
            </div>
            {!showCancellation && (
              <button
                className="io-btn io-btn--ghost io-btn--sm"
                onClick={() => setShowCancellation(true)}
                type="button"
              >
                Check cancellation
              </button>
            )}
          </header>

          {showCancellation && !requestReady && (
            <form className="od-cancel" onSubmit={previewCancellation}>
              <label className="co-field">
                <span>Reason</span>
                <select defaultValue="" required>
                  <option disabled value="">
                    Select a reason
                  </option>
                  <option>Ordered by mistake</option>
                  <option>Need a different size</option>
                  <option>Delivery timing changed</option>
                </select>
              </label>
              <div className="od-cancel__refund">
                <span>Estimated refund</span>
                <strong>{order.total}</strong>
                <small>Back to the original payment method</small>
              </div>
              <button className="io-btn io-btn--solid" type="submit">
                Preview request
              </button>
            </form>
          )}

          {requestReady && (
            <div className="od-cancel__done" role="status">
              <Check aria-hidden size={16} strokeWidth={2} />
              <p>
                <strong>Cancellation request is ready.</strong>
                <small>
                  This preview changed no order state — submission is connected with the
                  order API.
                </small>
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
