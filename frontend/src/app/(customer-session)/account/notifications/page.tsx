"use client";

import { Bell, Trash2 } from "lucide-react";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { AccountSection } from "@/components/account/account-section";
import { createLocalStore } from "@/lib/local-store";

/**
 * Notifications — the inbox, and nothing else.
 *
 * What used to be here was a panel of preference switches and a table naming
 * the email and mobile the messages go to; both were settings about messages
 * rather than the messages themselves, and the destinations were the third
 * place in the account printing the same two contact details.
 *
 * So this is the inbox: one row per message, and a delete that only appears on
 * the row under the pointer. Deletions are stored, because an inbox that
 * refills itself on reload is a mock, not an inbox.
 */
type Message = {
  id: string;
  subject: string;
  preview: string;
  type: "Order" | "Delivery" | "Drop" | "Restock" | "Support";
  when: string;
  unread?: boolean;
};

const MESSAGES: Message[] = [
  {
    id: "msg-01",
    subject: "Order ICE-1048 is on its way",
    preview: "Picked up in Bengaluru · arriving 12 — 14 Aug",
    type: "Delivery",
    when: "2 hours ago",
    unread: true,
  },
  {
    id: "msg-02",
    subject: "Drop 002 opens Friday, 08:00",
    preview: "Six pieces, numbered. Nothing restocked after the run.",
    type: "Drop",
    when: "Yesterday",
    unread: true,
  },
  {
    id: "msg-03",
    subject: "Back in your size: Shadow Cargo 02",
    preview: "The 32 you saved is available again in Charcoal.",
    type: "Restock",
    when: "3 days ago",
  },
  {
    id: "msg-04",
    subject: "Support replied to your query",
    preview: "About the exchange on ICE-1027 — one working day to collect.",
    type: "Support",
    when: "5 days ago",
  },
  {
    id: "msg-05",
    subject: "Order ICE-1027 delivered",
    preview: "Left with the resident. Returns stay open for 30 days.",
    type: "Order",
    when: "12 Aug 2026",
  },
];

/* Only the ids that were cleared are stored, not the messages: the inbox is
   still fixture data, and keeping a copy of it would mean a new seeded message
   never reaching an account that had read the old ones. */
const store = createLocalStore<{ deleted: string[] }>("iced-out-inbox-v1", { deleted: [] });

export default function NotificationsPage() {
  const { deleted } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const messages = useMemo(
    () => MESSAGES.filter((message) => !deleted.includes(message.id)),
    [deleted],
  );

  const remove = useCallback((id: string) => {
    const current = store.getSnapshot();
    if (current.deleted.includes(id)) return;
    store.write({ deleted: [...current.deleted, id] });
  }, []);

  const unread = messages.filter((message) => message.unread).length;

  return (
    <AccountSection
      copy="Order and delivery messages, drop alerts, restocks and support replies — newest first."
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
            Order and delivery messages will appear here as they are sent.
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
                {messages.map((message) => (
                  <tr data-unread={message.unread ? "" : undefined} key={message.id}>
                    <th scope="row">
                      <span className="io-table__primary">
                        {message.unread && <span aria-label="Unread" className="io-dot" />}
                        {message.subject}
                      </span>
                      <span className="io-table__sub">{message.preview}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AccountSection>
  );
}
