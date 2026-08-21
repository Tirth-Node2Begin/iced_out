"use client";

import { Bell, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { AccountSection } from "@/components/account/account-section";
import { useOrders } from "@/features/07-orders/orders-context";
import { useSupportInbox } from "@/features/14-support/support-store";
import { useAuth } from "@/features/20-auth-security/auth-context";
import { createLocalStore } from "@/lib/local-store";

/**
 * Notifications — the inbox, and nothing else.
 *
 * What used to be here was five written-out messages: an order on its way, a
 * drop opening Friday, a restock in a saved size, a support reply about
 * "ICE-1027". None of them referred to anything. They were the same five for
 * every account, they never changed, and the support one in particular was a
 * lie of exactly the kind this screen exists to avoid — telling a shopper they
 * had an answer waiting when nobody had written one.
 *
 * Every row is now derived from something the account actually holds:
 *
 *   Support   an answered query — `GET /me/support`, the same record the
 *             thread on /account/support opens.
 *   Order     the shopper's own orders — `GET /me/orders`.
 *
 * Nothing is invented, so an inbox with nothing in it stays empty. That is the
 * honest state for a new account, and it is what makes a row that DOES appear
 * worth opening.
 *
 * Read and deleted ids are stored locally rather than on the server. There is no
 * notifications table to mark against, and a message here is a VIEW of a record
 * that lives elsewhere — so what is kept is only which of them this person has
 * dealt with, and clearing it can never destroy the thing it points at.
 */
type Message = {
  id: string;
  subject: string;
  preview: string;
  type: "Order" | "Delivery" | "Support";
  when: string;
  /** Where the thing this is about actually lives. */
  href: string;
};

/**
 * Only the ids that were read or cleared, never the messages.
 *
 * The messages are derived, so storing them would mean holding a stale copy of
 * a reply an operator has since corrected.
 */
const store = createLocalStore<{ deleted: string[]; read: string[] }>(
  "iced-out-inbox-v2",
  { deleted: [], read: [] },
);

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const { queries } = useSupportInbox(isAuthenticated);
  const { orders } = useOrders();

  const { deleted, read } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const messages = useMemo(() => {
    const rows: Message[] = [];

    /* An answered query, once. An open one is not a notification — there is
       nothing yet to tell them. */
    for (const query of queries) {
      if (query.status !== "Resolved" || query.reply === "") continue;

      rows.push({
        id: `support-${query.reference}`,
        subject: `Support replied to ${query.reference}`,
        /* The first line of the actual reply, not a summary of it. A preview
           that paraphrases is a second thing to keep true. */
        preview: firstLine(query.reply),
        type: "Support",
        when: query.answeredAt || query.sentAt,
        href: "/account/support",
      });
    }

    for (const order of orders) {
      const delivered = order.status === "Delivered";

      rows.push({
        id: `order-${order.number}`,
        subject: delivered
          ? `Order ${order.number} delivered`
          : order.status === "Payment failed"
            ? `Order ${order.number} needs a payment`
            : `Order ${order.number} is being prepared`,
        preview: delivered
          ? `${order.items} · returns stay open from delivery.`
          : `${order.items} · ${order.total}`,
        type: delivered ? "Delivery" : "Order",
        when: order.date,
        href: `/account/orders/detail?id=${encodeURIComponent(order.id)}`,
      });
    }

    return rows.filter((message) => !deleted.includes(message.id));
  }, [deleted, orders, queries]);

  const remove = useCallback((id: string) => {
    const current = store.getSnapshot();
    if (current.deleted.includes(id)) return;
    store.write({ ...current, deleted: [...current.deleted, id] });
  }, []);

  const markRead = useCallback((id: string) => {
    const current = store.getSnapshot();
    if (current.read.includes(id)) return;
    store.write({ ...current, read: [...current.read, id] });
  }, []);

  const unread = messages.filter((message) => !read.includes(message.id)).length;

  return (
    <AccountSection
      copy="Order and delivery updates and support replies — newest first, and every one of them opens the record it is about."
      eyebrow="Account / Inbox"
      title="Everything we have sent you."
      actions={
        <span className="io-badge io-badge--plain">
          <Bell aria-hidden size={12} strokeWidth={1.8} />
          {unread} unread
        </span>
      }
    >
      <section className="io-panel io-panel--flush">
        {messages.length === 0 ? (
          <div className="io-empty">
            <strong>Inbox empty</strong>
            Order updates and support replies appear here as they happen.
          </div>
        ) : (
          <div className="io-tablewrap">
            <table className="io-table io-table--inbox">
              <thead>
                <tr>
                  <th scope="col">Message</th>
                  <th scope="col">Type</th>
                  <th scope="col">When</th>
                  <th scope="col">
                    <span className="sr-only">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => {
                  const isUnread = !read.includes(message.id);

                  return (
                    <tr data-unread={isUnread ? "" : undefined} key={message.id}>
                      <th scope="row">
                        {/* The row IS the way through. A notification that
                            cannot be opened is a notice, and the reply it is
                            telling them about is two screens away. */}
                        <Link
                          className="io-inbox__link"
                          href={message.href}
                          onClick={() => markRead(message.id)}
                        >
                          <span className="io-table__primary">
                            {isUnread && <span aria-label="Unread" className="io-dot" />}
                            {message.subject}
                          </span>
                          <span className="io-table__sub">{message.preview}</span>
                        </Link>
                      </th>
                      <td>
                        <span className="io-badge io-badge--plain">{message.type}</span>
                      </td>
                      <td>
                        <span className="io-table__sub">{message.when}</span>
                      </td>
                      <td data-align="right">
                        {/* Visible to the keyboard and to a screen reader at all
                            times — only the *pointer* affordance is on hover. */}
                        <button
                          className="io-rowdel"
                          onClick={() => remove(message.id)}
                          title={`Delete "${message.subject}"`}
                          type="button"
                        >
                          <Trash2 aria-hidden size={15} strokeWidth={1.7} />
                          <span className="sr-only">Delete “{message.subject}”</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AccountSection>
  );
}

/** The opening line of a reply, for the row under the subject. */
function firstLine(reply: string) {
  const line = reply.split("\n").find((entry) => entry.trim() !== "")?.trim() ?? reply;
  return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}
