"use client";

import { ArrowRight, Archive, PackageSearch, Search, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AccountSection } from "@/components/account/account-section";
import { useOrders } from "@/features/07-orders/orders-context";

/**
 * The purchase archive.
 *
 * Orders are records, so they are a table: one row per purchase, the money
 * right-aligned and tabular, the state as a badge. The filter is real — it
 * matches the number and the pieces, which is how people actually look for an
 * order they half remember.
 */
const STATES = ["All", "Processing", "Delivered", "Payment failed"] as const;

export default function OrdersPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<(typeof STATES)[number]>("All");
  /* One list, from the store: an order placed at checkout appears here in the
     same table as the seeded ones, which is what makes the count in the rail
     and the rows under it agree. */
  const { orders: allOrders } = useOrders();

  const term = query.trim().toLowerCase();
  const orders = allOrders.filter((order) => {
    const matchesState = state === "All" || order.status === state;
    const matchesTerm =
      term.length === 0 ||
      order.number.toLowerCase().includes(term) ||
      order.items.toLowerCase().includes(term);
    return matchesState && matchesTerm;
  });

  return (
    <AccountSection
      copy="Every purchase keeps the item names, variants, prices, discounts and tax it was made with, even after the catalogue moves on."
      eyebrow="Account / Purchase archive"
      title="Everything you have bought."
    >
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <PackageSearch aria-hidden size={16} strokeWidth={1.6} />
              {orders.length} of {allOrders.length} orders
            </h3>
            <p className="io-panel__note">Search by order number or by a piece in it.</p>
          </div>
          <div className="io-actions">
            {STATES.map((option) => (
              <button
                className={`io-btn io-btn--sm ${state === option ? "io-btn--solid" : "io-btn--ghost"}`}
                key={option}
                onClick={() => setState(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </header>

        <label className="io-search" style={{ marginBottom: 12 }}>
          <Search aria-hidden size={16} strokeWidth={1.7} />
          <input
            aria-label="Search orders"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="IO-2026-… or a piece name"
            value={query}
          />
        </label>

        {orders.length === 0 ? (
          <div className="io-empty">
            <strong>Nothing matches that</strong>
            Try the order number, or clear the filter.
          </div>
        ) : (
          <div className="io-tablewrap">
            <table className="io-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Pieces</th>
                  <th scope="col">Payment</th>
                  <th data-align="right" scope="col">Total</th>
                  <th scope="col">Status</th>
                  <th data-align="right" scope="col">
                    <span className="sr-only">Track</span>
                  </th>
                  <th data-align="right" scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <th scope="row">
                      {/* The number is the link. Looking for an order means
                          looking for its number, so that is what has to be
                          pressable — not a word at the far end of the row. */}
                      <Link className="io-table__primary" href={`/account/orders/${order.id}`}>
                        {order.number}
                      </Link>
                      <span className="io-table__sub">{order.date}</span>
                    </th>
                    <td>
                      <span className="io-table__primary">
                        {order.lines.length} item{order.lines.length === 1 ? "" : "s"}
                      </span>
                      <span className="io-table__sub">{order.items}</span>
                    </td>
                    <td>
                      <span className="io-table__primary">{order.payment.method}</span>
                      <span className="io-table__sub">{order.payment.status}</span>
                    </td>
                    <td className="io-table__num" data-align="right">
                      {order.total}
                    </td>
                    <td>
                      <span
                        className={`io-badge ${
                          order.status === "Delivered"
                            ? "io-badge--ok"
                            : order.status === "Payment failed"
                              ? "io-badge--danger"
                              : "io-badge--live"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td data-align="right">
                      {/* Tracking sits in the row because that is the question
                          an open order gets asked: not "what did I buy", but
                          "where is it". A delivered order has no answer left
                          to give, so it does not offer one — and an unpaid one
                          is asked something else entirely. */}
                      {order.status === "Payment failed" ? (
                        <Link href={`/account/orders/${order.id}`}>
                          Pay now
                          <ArrowRight aria-hidden size={14} strokeWidth={1.7} />
                        </Link>
                      ) : (
                        order.status !== "Delivered" &&
                        order.shipment.token && (
                          <Link href={`/track/${order.shipment.token}`}>
                            Track
                            <Truck aria-hidden size={14} strokeWidth={1.7} />
                          </Link>
                        )
                      )}
                    </td>
                    <td data-align="right">
                      <Link href={`/account/orders/${order.id}`}>
                        Open
                        <ArrowRight aria-hidden size={14} strokeWidth={1.7} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="io-note">
        <Archive aria-hidden size={16} strokeWidth={1.7} />
        <p>
          <strong>Order snapshots are immutable</strong>
          A price change, a rename or a sold-out variant never rewrites an order you
          already placed — which is what makes a return or a refund provable months
          later.
        </p>
      </div>
    </AccountSection>
  );
}
