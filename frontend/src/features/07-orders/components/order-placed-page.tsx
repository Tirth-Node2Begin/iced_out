"use client";

import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  CircleDashed,
  CircleX,
  ClipboardList,
  CreditCard,
  LifeBuoy,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  PackageSearch,
  Receipt,
  RefreshCw,
  TriangleAlert,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { formatPrice } from "@/features/02-products";
import { useOrders, type OrderRecord } from "@/features/07-orders/orders-context";
import { openRazorpayCheckout } from "@/features/09-payment/razorpay";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * `/orders/<id>` — the screen a purchase lands on.
 *
 * This is NOT the archive entry at `/account/orders/<id>`, and the difference
 * is the whole reason it exists. The archive answers "what did I buy months
 * ago"; this answers the question a shopper has in the ten seconds after
 * pressing pay — did it work, what happens next, and when. So the first thing
 * under the confirmation is not the receipt, it is the STATE of the order in
 * the four places state actually lives: the order, the money, the studio and
 * the courier. All four are shown at their opening value rather than hidden
 * until something changes, because "not assigned yet" is an answer and a blank
 * row is not.
 *
 * Every fact appears ONCE. The page frame states the order number, the date,
 * the status, the money and the arrival window; nothing below it repeats them,
 * which is why the confirmation is a line rather than a second headline and why
 * a note under a panel title only exists where the title does not already say
 * it. Copy that restates the screen is not detail, it is noise sitting where
 * detail should be.
 *
 * Nothing here invents progress. A parcel placed a minute ago has not been
 * picked, packed, scanned or handed to anyone, and the rail says so — every
 * later update has to be readable against this one, and it cannot be if the
 * first screen already claimed a step that had not happened.
 *
 * The order is read out of the same store the archive reads, so this page and
 * the account never disagree — it is one record, seen from the end it was
 * placed at.
 */

/* -------------------------------------------------------------------------- */
/*  the model                                                                 */

/**
 * What a stage on the rail can be.
 *
 * `due` is deliberately separate from `waiting`: cash on delivery is a payment
 * that is SCHEDULED, not a payment that is missing, and drawing the two the
 * same way is how a COD shopper reads their own order as unpaid.
 */
type StageState = "done" | "current" | "due" | "waiting" | "failed";

type Stage = {
  key: string;
  title: string;
  note: string;
  state: StageState;
  icon: typeof Check;
};

type Tone = "ok" | "live" | "danger" | "idle";

type Tile = {
  key: string;
  label: string;
  value: string;
  note: string;
  tone: Tone;
  icon: typeof Receipt;
};

/** `Processing`, `Captured`, `Not started`, `Not assigned` — the opening four. */
function tilesFor(order: OrderRecord): Tile[] {
  const delivered = order.status === "Delivered";
  const unpaid = order.payment.status === "Failed";
  const paid = order.payment.status === "Captured";

  return [
    {
      key: "order",
      label: "Order",
      value: order.status,
      note: `Placed ${order.date}`,
      tone: delivered ? "ok" : unpaid ? "danger" : "live",
      icon: ClipboardList,
    },
    {
      key: "payment",
      label: "Payment",
      value: order.payment.status,
      note: order.payment.method,
      tone: paid ? "ok" : unpaid ? "danger" : "live",
      icon: paid ? CreditCard : Banknote,
    },
    {
      key: "fulfilment",
      label: "Fulfilment",
      // The studio has not touched it yet, and that is the honest opening
      // value. "Preparing" would be a claim about work nobody has started.
      value: delivered ? "Completed" : unpaid ? "On hold" : "Not started",
      note: delivered ? "Picked and packed" : unpaid ? "Held for payment" : "Pick and pack",
      tone: delivered ? "ok" : "idle",
      icon: Package,
    },
    {
      key: "shipment",
      label: "Shipment",
      value: delivered ? "Delivered" : "Not assigned",
      note: order.shipment.awb,
      tone: delivered ? "ok" : "idle",
      icon: Truck,
    },
  ];
}

/** The journey, at the only point on it this order has actually reached. */
function stagesFor(order: OrderRecord, placedTime: string | null): Stage[] {
  const delivered = order.status === "Delivered";
  const unpaid = order.payment.status === "Failed";
  const paid = order.payment.status === "Captured";
  const pieces = order.lines.reduce((count, line) => count + line.quantity, 0);

  return [
    {
      key: "placed",
      title: "Order placed",
      note: placedTime ? `${order.date} · ${placedTime}` : order.date,
      state: "done",
      icon: Check,
    },
    {
      key: "payment",
      title: paid ? "Payment captured" : unpaid ? "Payment failed" : "Payment on delivery",
      note: unpaid ? "Nothing charged" : paid ? order.payment.reference : `${order.total} at the door`,
      state: paid ? "done" : unpaid ? "failed" : "due",
      icon: paid ? Check : unpaid ? CircleX : Banknote,
    },
    {
      key: "confirmed",
      title: unpaid ? "Held" : "Confirmed",
      note: unpaid ? "Nothing reserved" : `${pieces} piece${pieces === 1 ? "" : "s"} reserved`,
      state: unpaid ? "waiting" : "done",
      icon: BadgeCheck,
    },
    {
      key: "packing",
      title: delivered ? "Packed" : "Packing",
      note: unpaid ? "Queued" : delivered ? "Scan-to-pack done" : "Scan-to-pack at the studio",
      state: delivered ? "done" : unpaid ? "waiting" : "current",
      icon: Package,
    },
    {
      key: "dispatch",
      title: delivered ? "Dispatched" : "Dispatch",
      note: order.shipment.awb,
      state: delivered ? "done" : "waiting",
      icon: Truck,
    },
    {
      key: "delivery",
      title: delivered ? "Delivered" : "Delivery",
      note: order.shipment.estimate,
      state: delivered ? "done" : "waiting",
      icon: PackageCheck,
    },
  ];
}

const STAGE_GLYPH: Record<StageState, typeof Check | null> = {
  done: Check,
  failed: CircleX,
  // `current` and `due` keep the stage's own icon — the state is carried by the
  // ring around it, and swapping the glyph as well loses what the step IS.
  current: null,
  due: null,
  waiting: CircleDashed,
};

/** `13:42` — only for an order this device actually placed. */
function formatPlacedTime(placedAt: number) {
  if (!placedAt) return null;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(placedAt));
}

/* -------------------------------------------------------------------------- */
/*  the page                                                                  */

export function OrderPlacedPage({ orderId }: { orderId: string }) {
  const hydrated = useHydrated();
  const { findOrder, restored, settlePayment } = useOrders();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  /* Whether this is the arrival or a revisit rides in the URL, so there is no
     flag anywhere that has to be cleared — checkout lands on `?placed=1`, and
     the same link opened tomorrow simply has no query on it. */
  const arrived = useSearchParams().get("placed");

  const order = findOrder(orderId);

  /* An order placed on this device lives in its storage and nowhere else, so
     an id that is not a fixture cannot be judged missing until that read has
     happened — which is after mount. */
  if (!hydrated || !restored) {
    return (
      <PageFrame eyebrow="Order" title={<>Your <em>order</em></>}>
        <div className="co-load" role="status">
          <Loader2 aria-hidden className="co-spin" size={16} />
          Opening your order…
        </div>
      </PageFrame>
    );
  }

  if (!order) {
    return (
      <PageFrame
        eyebrow="Order"
        lede="Nothing on this device answers to that order id."
        title={<>Order <em>not found</em></>}
      >
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
      </PageFrame>
    );
  }

  const unpaid = order.payment.status === "Failed";
  const cod = order.payment.status === "Due on delivery";
  const delivered = order.status === "Delivered";
  const firstName = order.contact?.name.trim().split(/\s+/)[0];
  const placedTime = formatPlacedTime(order.placedAt);
  const stages = stagesFor(order, placedTime);
  const tiles = tilesFor(order);

  /* How far the track is filled: the last stage that has actually happened, not
     the one after it. A rail drawn one step ahead of the parcel is the same lie
     as a status that says "packed" before anyone has picked it. */
  const reached = stages.reduce(
    (last, stage, index) => (stage.state === "waiting" ? last : index),
    0,
  );

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
      /* Settled onto the order that already exists rather than placed again —
         a second order for the same bag is the one outcome a retry must never
         produce. The store moves it out of "Payment failed" and this screen
         re-renders against the new record. */
      settlePayment(order.id, {
        method: "Razorpay · Card / UPI / Netbanking",
        reference: result.paymentId,
        outcome: "captured",
      });
      return;
    }

    /* A second failure rewrites nothing: the record already says unpaid, and
       what is new is the reason — which belongs on screen, not in the order. */
    setRetryError(result.message);
  }

  /* One header, not two. The frame already names the order, dates it and prints
     the three figures beside it, so the confirmation below is a LINE — the mark,
     one sentence and the one thing there is to do next. A second display
     headline under the first was the same three facts twice at two sizes. */
  return (
    <PageFrame
      back={{ href: "/account/orders", label: "Your orders" }}
      eyebrow={
        unpaid
          ? "Payment unsuccessful"
          : delivered
            ? "Delivered"
            : cod
              ? "Order placed"
              : "Order confirmed"
      }
      lede={
        unpaid
          ? "Nothing was charged. The order is held exactly as it was until the payment clears."
          : delivered
            ? `Placed ${order.date} · ${order.shipment.estimate}`
            : `Placed ${order.date}${placedTime ? `, ${placedTime}` : ""} · Confirmation sent to ${
                order.contact?.email ?? "your inbox"
              }`
      }
      spec={[
        { label: "Status", value: order.status },
        { label: cod ? "Due on delivery" : "Paid", value: order.total },
        { label: "Arriving", value: order.shipment.estimate },
      ]}
      title={<>Order <em>{order.number}</em></>}
    >
      <div className="op">
        {/* ------------------------------------------------------- the outcome */}
        <section className="op-flag" data-state={unpaid ? "failed" : "ok"}>
          <span aria-hidden className="op-flag__mark">
            {unpaid ? <CircleX size={15} strokeWidth={2.2} /> : <Check size={15} strokeWidth={2.6} />}
          </span>

          <p className="op-flag__text">
            {unpaid
              ? (order.payment.note ?? "The gateway did not confirm this payment.")
              : delivered
                ? "Delivered. The return window runs from the delivery date."
                : arrived
                  ? `Thank you${firstName ? `, ${firstName}` : ""} — your order is confirmed.`
                  : "Confirmed and in the queue to be packed."}
          </p>

          {unpaid ? (
            <button
              className="io-btn io-btn--solid io-btn--sm"
              disabled={retrying || !order.money}
              onClick={retryPayment}
              type="button"
            >
              {retrying ? (
                <>
                  <Loader2 aria-hidden className="co-spin" size={14} />
                  Waiting for the gateway…
                </>
              ) : (
                <>
                  <RefreshCw aria-hidden size={14} strokeWidth={1.7} />
                  Retry payment · {order.total}
                </>
              )}
            </button>
          ) : (
            order.shipment.token && (
              <Link
                className="io-btn io-btn--ghost io-btn--sm"
                href={`/track/${order.shipment.token}`}
              >
                <Truck aria-hidden size={14} strokeWidth={1.7} />
                Track
              </Link>
            )
          )}

          {retryError && (
            <div className="co-alert op-flag__alert" role="alert">
              <TriangleAlert aria-hidden size={16} strokeWidth={1.7} />
              <p>
                <strong>That attempt did not complete either</strong>
                {retryError}
              </p>
            </div>
          )}
        </section>

        {/* -------------------------------------------------- the four statuses */}
        {/* The point of the screen. Every one of these has an opening value, and
            an opening value is information — a shopper who can see that no
            courier has been assigned yet does not go looking for a tracking
            number that does not exist. */}
        <section className="op-board">
          {tiles.map((tile) => {
            const Icon = tile.icon;

            return (
              <article className="op-tile" data-tone={tile.tone} key={tile.key}>
                <header className="op-tile__head">
                  <span aria-hidden className="op-tile__glyph">
                    <Icon size={14} strokeWidth={1.7} />
                  </span>
                  <span className="op-tile__label">{tile.label}</span>
                </header>
                <p className="op-tile__value">
                  <i aria-hidden className="op-tile__dot" />
                  {tile.value}
                </p>
                <p className="op-tile__note">{tile.note}</p>
              </article>
            );
          })}
        </section>

        {/* ---------------------------------------------------------- the rail */}
        <section className="io-panel">
          <header className="io-panel__head">
            <div>
              <h3 className="io-panel__title">
                <Truck aria-hidden size={16} strokeWidth={1.6} />
                Where it is now
              </h3>
              <p className="io-panel__note">
                {unpaid
                  ? "Held at the first step. Nothing reserved, no courier asked for."
                  : `${order.shipment.service} · arriving ${order.shipment.estimate}`}
              </p>
            </div>
          </header>

          <ol className="op-rail">
            {stages.map((stage, index) => {
              const Glyph = STAGE_GLYPH[stage.state] ?? stage.icon;

              return (
                <li
                  aria-current={index === reached ? "step" : undefined}
                  className="op-rail__step"
                  data-state={stage.state}
                  key={stage.key}
                >
                  {/* The connector INTO this step, so it lights with the step it
                      leads to rather than the one it leaves. */}
                  <span aria-hidden className="op-rail__line" />
                  <span className="op-rail__dot">
                    <Glyph size={13} strokeWidth={stage.state === "done" ? 2.4 : 1.8} />
                  </span>
                  <p className="op-rail__body">
                    <strong>{stage.title}</strong>
                    <small>{stage.note}</small>
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* --------------------------------------------------------- the goods */}
        <div className="op-grid">
          <section className="io-panel">
            <header className="io-panel__head">
              <div>
                <h3 className="io-panel__title">
                  <Receipt aria-hidden size={16} strokeWidth={1.6} />
                  What you bought
                </h3>
              </div>
            </header>

            <ul className="op-lines">
              {order.lines.map((line) => (
                <li key={line.id}>
                  <span className="op-lines__body">
                    <strong>{line.name}</strong>
                    <small>{line.variant} · Qty {line.quantity}</small>
                  </span>
                  <span className="op-lines__price">{line.price}</span>
                </li>
              ))}
            </ul>

            <dl className="op-totals">
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
              <div className="op-totals__sum">
                <dt>{cod ? "Due on delivery" : "Paid"}</dt>
                <dd>{order.total}</dd>
              </div>
            </dl>
          </section>

          <section className="io-panel">
            <header className="io-panel__head">
              <div>
                <h3 className="io-panel__title">
                  <MapPin aria-hidden size={16} strokeWidth={1.6} />
                  Going to
                </h3>
              </div>
            </header>

            {order.address && (
              <address className="co-address op-address">
                <strong>{order.contact?.name}</strong>
                <span>{order.address.line}</span>
                <span>
                  {order.address.city}, {order.address.state} {order.address.postalCode}
                </span>
                {order.contact && <span>{order.contact.mobile}</span>}
              </address>
            )}

            <dl className="op-meta">
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
              {/* A gateway id is worth quoting; "Collected at delivery" is not a
                  reference, it is the method again in other words. */}
              {!cod && (
                <div>
                  <dt>Reference</dt>
                  <dd className="op-meta__ref">{order.payment.reference}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* --------------------------------------------------------- the doors */}
        {/* A row, not a panel. The paragraph that used to sit here explained what
            the four statuses above already say. */}
        <div className="op-doors">
          <Link className="io-btn io-btn--ghost" href="/account/orders">
            <PackageSearch aria-hidden size={15} strokeWidth={1.7} />
            All orders
          </Link>
          <Link className="io-btn io-btn--ghost" href="/account/support">
            <LifeBuoy aria-hidden size={15} strokeWidth={1.7} />
            Support
          </Link>
          <Link className="io-btn io-btn--solid" href="/new-drop">
            Continue shopping
            <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
