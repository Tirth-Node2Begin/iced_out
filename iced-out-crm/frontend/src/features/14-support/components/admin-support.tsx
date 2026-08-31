"use client";

import { LifeBuoy, MessageSquareText, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AdminPage,
  Btn,
  DetailList,
  Empty,
  Field,
  Modal,
  Section,
  Status,
} from "@/components/shell/admin-ui";
import { Toolbar } from "@/components/shell/toolbar";
import { NO_ORDER, type SupportQuery } from "@/features/14-support/data/support-queries";
import {
  useSupportDesk,
} from "@/features/14-support/support-store";

/**
 * Support, the whole of it.
 *
 * One table of what customers have asked, and one dialog to answer any row of
 * it in. There is nothing else to learn: no ticket queue to triage into, no
 * knowledge base to keep in step, and no live chat waiting for someone to be
 * online.
 */
const FILTERS = ["Open", "Resolved", "All"] as const;
type Filter = (typeof FILTERS)[number];

/* Enough of the question to recognise the row by. The whole of it is one click
   away, and a row that grows to four lines stops being a table. */
function preview(message: string) {
  return message.length > 74 ? `${message.slice(0, 74).trimEnd()}…` : message;
}

export function AdminSupport() {
  const { queries, ready, loading, error, resolve, reopen } = useSupportDesk();
  const [filter, setFilter] = useState<Filter>("Open");
  /* The row being answered. Null is the table on its own. */
  const [opened, setOpened] = useState<string | null>(null);

  const open = queries.filter((query) => query.status === "Open");
  const resolved = queries.length - open.length;

  const visible = filter === "All" ? queries : queries.filter((query) => query.status === filter);
  const answering = queries.find((query) => query.reference === opened) ?? null;

  /* Three nothings, told apart. An empty table under "Support" reads as broken;
     on a store nobody has written to it is just the truth. */
  const emptyNote = error
    ? error
    : loading && !ready
      ? "Reading the queue…"
      : "Nothing has been asked yet. Queries arrive here from the shopper's support page.";

  return (
    <AdminPage
      eyebrow="Support"
      icon={LifeBuoy}
      lede="Everything customers send from their support page arrives in this table. Open a row, read what they asked, write one reply — that reply is what resolves it and what the customer sees."
      spec={[
        { label: "Open", value: String(open.length).padStart(2, "0") },
        { label: "Resolved", value: String(resolved).padStart(2, "0") },
        { label: "Total", value: String(queries.length).padStart(2, "0") },
      ]}
      title={
        <>
          Customer <em>queries</em>
        </>
      }
    >
      {/* The states live in the toolbar band, where every other screen keeps
          them, rather than hanging off the section heading. This was the last
          of the four places filters used to appear in this console. */}
      <Toolbar
        chips={
          <div className="aui-chips">
            {FILTERS.map((entry) => (
              <button
                aria-pressed={filter === entry ? "true" : "false"}
                className="aui-chip"
                key={entry}
                onClick={() => setFilter(entry)}
                type="button"
              >
                {entry}
                <b>{entry === "All" ? queries.length : entry === "Open" ? open.length : resolved}</b>
              </button>
            ))}
          </div>
        }
      />

      <Section
        copy="A query about an order carries that order number with it, so you can answer without going looking for it."
        eyebrow="Inbox"
        title="Queries from customers"
      >
        {visible.length === 0 ? (
          <Empty
            copy={queries.length === 0 ? emptyNote : `Nothing is ${filter.toLowerCase()} right now.`}
            icon={MessageSquareText}
            title={
              queries.length === 0
                ? error
                  ? "Queue unavailable"
                  : loading && !ready
                    ? "Loading queries"
                    : "No queries yet"
                : `No ${filter.toLowerCase()} queries`
            }
          />
        ) : (
          <div className="aui-tablewrap">
            <table className="aui-table">
              <thead>
                <tr>
                  <th scope="col">Query</th>
                  <th data-hide="sm" scope="col">
                    Customer
                  </th>
                  <th data-hide="sm" scope="col">
                    About
                  </th>
                  <th data-align="right" scope="col">
                    Order
                  </th>
                  <th scope="col">State</th>
                  <th data-align="right" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((query) => (
                  <tr key={query.reference}>
                    <td>
                      <span className="aui-table__primary">
                        <strong>{query.reference}</strong>
                        <small>{preview(query.message)}</small>
                      </span>
                    </td>
                    <td data-hide="sm">{query.customer}</td>
                    <td data-hide="sm">{query.topic}</td>
                    <td className="aui-table__num" data-align="right">
                      {query.order === NO_ORDER ? "—" : query.order}
                    </td>
                    <td>
                      <Status value={query.status} />
                    </td>
                    <td data-align="right">
                      <Btn onClick={() => setOpened(query.reference)} size="sm" variant="solid">
                        {query.status === "Open" ? "Resolve" : "View"}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {answering && (
        <ResolveDialog
          key={answering.reference}
          onClose={() => setOpened(null)}
          onReopen={reopen}
          onResolve={resolve}
          query={answering}
        />
      )}
    </AdminPage>
  );
}

/**
 * One query, answered.
 *
 * Keyed on the reference by its parent, so opening a different row starts with
 * an empty reply box rather than someone else's half-written one.
 */
function ResolveDialog({
  query,
  onClose,
  onResolve,
  onReopen,
}: {
  query: SupportQuery;
  onClose: () => void;
  onResolve: (reference: string, reply: string) => Promise<void>;
  onReopen: (reference: string) => Promise<void>;
}) {
  const [reply, setReply] = useState(query.reply);
  /* Held while the reply is in flight, so a second click cannot send it twice. */
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = reply.trim();
    if (text === "") {
      toast.error("Write a reply first", { description: "An empty reply resolves nothing." });
      return;
    }

    setBusy(true);

    try {
      await onResolve(query.reference, text);
      toast.success("Reply sent", {
        description: `${query.reference} is resolved and ${query.customer} can read your answer.`,
      });
      onClose();
    } catch (caught) {
      toast.error("That reply could not be sent", {
        description: caught instanceof Error ? caught.message : "The server refused the change.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      description={`${query.customer} · ${query.topic}`}
      footNote={
        query.status === "Resolved"
          ? "Already answered. Sending again replaces the reply the customer sees."
          : "Sending the reply resolves the query."
      }
      footer={
        <>
          {query.status === "Resolved" && (
            <Btn
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onReopen(query.reference)
                  .then(() => {
                    toast.info("Reopened", {
                      description: `${query.reference} is back in the open list.`,
                    });
                    onClose();
                  })
                  .catch((caught: unknown) =>
                    toast.error("That could not be reopened", {
                      description:
                        caught instanceof Error
                          ? caught.message
                          : "The server refused the change.",
                    }),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Reopen
            </Btn>
          )}
          <Btn disabled={busy} onClick={() => void send()} variant="solid">
            <Send aria-hidden size={15} strokeWidth={1.7} />
            {busy
              ? "Sending…"
              : query.status === "Resolved"
                ? "Send the updated reply"
                : "Send reply and resolve"}
          </Btn>
        </>
      }
      icon={LifeBuoy}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      title={query.reference}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <DetailList
          rows={[
            { label: "Reply to", value: query.email },
            { label: "Order", value: query.order === NO_ORDER ? "Not about an order" : query.order },
            { label: "Sent", value: query.sentAt },
          ]}
        />

        <div className="aui-switchrow">
          <div>
            <strong>{query.customer} asked</strong>
            <small>{query.message}</small>
          </div>
        </div>

        <Field label="Your reply">
          <textarea
            onChange={(event) => setReply(event.target.value)}
            placeholder={`Answer ${query.customer}…`}
            rows={5}
            value={reply}
          />
        </Field>
      </div>
    </Modal>
  );
}
