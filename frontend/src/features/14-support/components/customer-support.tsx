"use client";

import { Check, ChevronDown, LifeBuoy, MessageSquareText, Search, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AccountSection } from "@/components/account/account-section";
import { useProfile } from "@/features/01-users/profile-context";
import { useOrders } from "@/features/07-orders/orders-context";
import {
  NO_ORDER,
  SUPPORT_TOPICS,
  type SupportQuery,
} from "@/features/14-support/data/support-queries";
import { useSupportInbox } from "@/features/14-support/support-store";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * Support.
 *
 * Answers first, then a way through to a person. The query form is the same
 * one the public /contact page sends — topic, order, message, consent, one
 * submit that hands back a reference — except the session already knows who is
 * asking, so it does not make the shopper retype their name and email.
 *
 * A sent query lands in the table below it rather than vanishing behind a
 * notice: what was asked, about which order, and what state it is in. It also
 * lands in the console's support inbox — the same `support_queries` row — and the
 * reply written there comes back to this table. One record, read from both ends,
 * which is what it only appeared to be while both ends were `localStorage`.
 *
 * The orders in the dropdown are this shopper's own, from `/me/orders`. They used
 * to be `orderFixtures`, so the query could be filed against somebody else's
 * order number.
 */
const FAQS = [
  {
    question: "When will my refund arrive?",
    answer:
      "Approved refunds are released the same day and usually reach the original payment destination within 5–7 business days. The bank, not the shop, sets the last leg.",
  },
  {
    question: "Can I exchange for another size?",
    answer:
      "A delivered item can request an exchange while replacement stock is still available in the size you want. If it has sold out, the request becomes a refund instead.",
  },
  {
    question: "Where is my order?",
    answer:
      "Open the order and use its tracking link for the courier's own timeline. Dispatch and delivery also arrive by email and SMS.",
  },
  {
    question: "How long do I have to return something?",
    answer:
      "Fourteen days from delivery, unworn and with tags attached. Start it from the order, and the return keeps the order's prices and taxes.",
  },
];

export function CustomerSupport() {
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const { orders } = useOrders();
  const [search, setSearch] = useState("");
  const [sent, setSent] = useState<SupportQuery | null>(null);
  const [sending, setSending] = useState(false);
  /** The last refusal from the server, cleared by the next attempt. */
  const [error, setError] = useState<string | null>(null);

  /* Only this shopper's threads, and the server decides which those are — it
     matches on the account rather than on an email the page passed in. The topics
     come with them, because they are the console's vocabulary. */
  const { queries, topics, send } = useSupportInbox(isAuthenticated);
  const topicOptions = topics.length > 0 ? topics : SUPPORT_TOPICS;

  const term = search.trim().toLowerCase();
  const visibleFaqs = FAQS.filter(
    ({ question, answer }) =>
      question.toLowerCase().includes(term) || answer.toLowerCase().includes(term),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    /* Read before the await: React clears the pooled event's target, and the form
       is reset below only once the send has actually succeeded. */
    const element = event.currentTarget;

    const order = String(form.get("order") ?? NO_ORDER);

    setSending(true);
    setError(null);

    try {
      /* The name and email are NOT sent. The server takes both from the account —
         a byline supplied by the request would let a query be filed under
         somebody else's name. */
      const query = await send({
        topic: String(form.get("topic") ?? topicOptions[0]),
        order: order === NO_ORDER ? "" : order,
        message: String(form.get("message") ?? ""),
      });

      setSent(query);
      element.reset();
    } catch (caught) {
      /* Reported on the page rather than swallowed: without this the form simply
         cleared and the shopper believed a question had been asked. */
      setSent(null);
      setError(caught instanceof Error ? caught.message : "That could not be sent just now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AccountSection
      copy="Start with the answers below. If none of them fit, send a query — the order and topic you pick stay attached to it."
      eyebrow="Account / Contextual support"
      title="How can we help?"
      actions={
        <span className="io-badge io-badge--plain">
          <LifeBuoy aria-hidden size={12} strokeWidth={1.8} />
          Replies within 2 working days
        </span>
      }
    >
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">Common questions</h3>
            <p className="io-panel__note">
              {visibleFaqs.length} of {FAQS.length} answers shown.
            </p>
          </div>
        </header>

        <label className="io-search">
          <Search aria-hidden size={16} strokeWidth={1.7} />
          <input
            aria-label="Search help"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search delivery, returns, fit, payments…"
            value={search}
          />
        </label>

        <div className="io-faqs" style={{ marginTop: 10 }}>
          {visibleFaqs.map(({ question, answer }) => (
            <details className="io-faq" key={question}>
              <summary>
                {question}
                <span aria-hidden>+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}

          {visibleFaqs.length === 0 && (
            <div className="io-empty">
              <strong>No answer matches “{search}”.</strong>
              Send it as a query below and a person will take it.
            </div>
          )}
        </div>
      </section>

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <MessageSquareText aria-hidden size={16} strokeWidth={1.6} />
              Send a query
            </h3>
            <p className="io-panel__note">
              Do not include card numbers, passwords or identity documents — support
              never needs them.
            </p>
          </div>
        </header>

        {sent ? (
          <>
            <div className="io-note io-note--ok">
              <Check aria-hidden size={16} strokeWidth={2} />
              <p>
                <strong>Query sent · {sent.reference}</strong>
                A reply goes to {sent.email} within two working days, and shows
                up against this reference below.
              </p>
            </div>
            <div className="io-actions io-actions--end" style={{ marginTop: 14 }}>
              <button
                className="io-btn io-btn--ghost"
                onClick={() => setSent(null)}
                type="button"
              >
                Ask something else
              </button>
            </div>
          </>
        ) : (
          <form className="io-form" onSubmit={(event) => void submit(event)}>
            {/* Said out loud. Without it the form cleared on a failure and the
                shopper believed the question had been asked. */}
            {error && (
              <p className="io-field__error" role="status">
                {error}
              </p>
            )}

            <div className="io-form__row">
              <label className="io-field">
                <span>Topic</span>
                <select defaultValue={topicOptions[0]} name="topic">
                  {topicOptions.map((topic) => (
                    <option key={topic}>{topic}</option>
                  ))}
                </select>
              </label>
              <label className="io-field">
                <span>
                  Related order <em>optional</em>
                </span>
                {/* This shopper's own orders. "No order" is the default rather
                    than the first order in a list they may not have placed. */}
                <select defaultValue={NO_ORDER} name="order">
                  <option>{NO_ORDER}</option>
                  {orders.map((order) => (
                    <option key={order.id}>{order.number}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="io-field">
              <span>
                Reply to <em>from your profile</em>
              </span>
              <input name="email" readOnly type="email" value={profile.email} />
            </label>

            <label className="io-field">
              <span>Message</span>
              <textarea
                minLength={20}
                name="message"
                placeholder="Tell us what happened and what outcome would help…"
                required
                rows={5}
              />
            </label>

            <label className="io-check">
              <input name="consent" required type="checkbox" />
              <span>
                I understand this is not a live chat, and a reply can take up to two
                working days.
              </span>
            </label>

            <div className="io-actions io-actions--end">
              {/* Held while the request is out: a double-tap on a slow connection
                  would otherwise file the same question twice. */}
              <button className="io-btn io-btn--solid" disabled={sending} type="submit">
                <Send aria-hidden size={15} strokeWidth={1.7} />
                {sending ? "Sending…" : "Send query"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">Your queries</h3>
            <p className="io-panel__note">
              {queries.length === 0
                ? "Nothing open. Sent queries appear here with their reference."
                : `${queries.length} sent. Open one to read the whole exchange.`}
            </p>
          </div>
        </header>

        {queries.length === 0 ? (
          <div className="io-empty">
            <strong>No open queries</strong>
            Answers above solve most of it — send one if they do not.
          </div>
        ) : (
          /* A thread each, not a table row each.

             The reply used to be squeezed into a cell as "Answered: …" beside
             the reference, which meant the one thing the shopper came back for
             was the one thing they could not read — a paragraph of support
             clipped to whatever the column happened to be wide enough for, with
             no way to open it. A query is a short conversation, so it is drawn
             as one: what they asked, then what was written back, under a
             summary they can open. */
          <div className="io-threads">
            {queries.map((query) => {
              const answered = query.status === "Resolved" && query.reply !== "";

              return (
                /* `<details>` rather than a dialog or a route: the exchange is
                   two paragraphs, the page is already showing its FAQ list the
                   same way, and it works before hydration. Answered threads
                   start OPEN — a shopper who came back for the reply should not
                   have to find it twice. */
                <details className="io-thread" key={query.reference} open={answered}>
                  <summary className="io-thread__head">
                    <span className="io-thread__id">
                      <strong>{query.reference}</strong>
                      <small>
                        {query.topic}
                        {query.order && query.order !== NO_ORDER ? ` · ${query.order}` : ""}
                      </small>
                    </span>

                    <span
                      className={`io-badge ${answered ? "io-badge--ok" : "io-badge--live"}`}
                    >
                      {answered ? "Answered" : "Awaiting reply"}
                    </span>

                    <ChevronDown aria-hidden className="io-thread__chev" size={16} />
                  </summary>

                  <div className="io-thread__body">
                    <div className="io-thread__turn">
                      <p className="io-thread__who">
                        You <span>{query.sentAt}</span>
                      </p>
                      {/* `pre-wrap`, so the paragraphs they typed survive. */}
                      <p className="io-thread__text">{query.message}</p>
                    </div>

                    {answered ? (
                      <div className="io-thread__turn io-thread__turn--reply">
                        <p className="io-thread__who">
                          Iced_out support
                          {query.answeredAt && <span>{query.answeredAt}</span>}
                        </p>
                        <p className="io-thread__text">{query.reply}</p>
                      </div>
                    ) : (
                      <p className="io-thread__waiting">
                        No reply yet. Support answers within two working days, and it
                        appears here and in your notifications.
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </AccountSection>
  );
}
