"use client";

import { Check, LifeBuoy, MessageSquareText, Search, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AccountSection } from "@/components/account/account-section";
import { orderFixtures } from "@/features/07-orders/data/order-fixtures";

/**
 * Support.
 *
 * Answers first, then a way through to a person. The query form is the same
 * one the public /contact page sends — topic, order, message, consent, one
 * submit that hands back a reference — except the session already knows who is
 * asking, so it does not make the shopper retype their name and email.
 *
 * A sent query lands in the table below it rather than vanishing behind a
 * notice: what was asked, about which order, and what state it is in.
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

type Query = {
  reference: string;
  topic: string;
  order: string;
  message: string;
};

export function CustomerSupport() {
  const [search, setSearch] = useState("");
  const [queries, setQueries] = useState<Query[]>([]);
  const [sent, setSent] = useState<Query | null>(null);

  const term = search.trim().toLowerCase();
  const visibleFaqs = FAQS.filter(
    ({ question, answer }) =>
      question.toLowerCase().includes(term) || answer.toLowerCase().includes(term),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query: Query = {
      reference: `IO-Q-${String(2026 + queries.length)}-${String(queries.length + 1).padStart(2, "0")}`,
      topic: String(form.get("topic") ?? "Delivery"),
      order: String(form.get("order") ?? "No order"),
      message: String(form.get("message") ?? ""),
    };

    setQueries((current) => [query, ...current]);
    setSent(query);
    event.currentTarget.reset();
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
                A reply goes to shopper@example.com within two working days. The
                reference above tracks it.
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
          <form className="io-form" onSubmit={submit}>
            <div className="io-form__row">
              <label className="io-field">
                <span>Topic</span>
                <select defaultValue="Delivery" name="topic">
                  <option>Delivery</option>
                  <option>Return or exchange</option>
                  <option>Payment or refund</option>
                  <option>Product and fit</option>
                  <option>Something else</option>
                </select>
              </label>
              <label className="io-field">
                <span>
                  Related order <em>optional</em>
                </span>
                <select defaultValue={orderFixtures[0]?.number ?? "No order"} name="order">
                  {orderFixtures.map((order) => (
                    <option key={order.id}>{order.number}</option>
                  ))}
                  <option>No order</option>
                </select>
              </label>
            </div>

            <label className="io-field">
              <span>
                Reply to <em>from your profile</em>
              </span>
              <input defaultValue="shopper@example.com" name="email" type="email" required />
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
              <button className="io-btn io-btn--solid" type="submit">
                <Send aria-hidden size={15} strokeWidth={1.7} />
                Send query
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
                : `${queries.length} sent from this device.`}
            </p>
          </div>
        </header>

        {queries.length === 0 ? (
          <div className="io-empty">
            <strong>No open queries</strong>
            Answers above solve most of it — send one if they do not.
          </div>
        ) : (
          <div className="io-tablewrap">
            <table className="io-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Topic</th>
                  <th scope="col">Order</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((query) => (
                  <tr key={query.reference}>
                    <th scope="row">
                      <span className="io-table__primary">{query.reference}</span>
                      <span className="io-table__sub">{query.message.slice(0, 60)}…</span>
                    </th>
                    <td>{query.topic}</td>
                    <td className="io-table__num">{query.order}</td>
                    <td>
                      <span className="io-badge io-badge--live">Awaiting reply</span>
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
