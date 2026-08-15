"use client";

import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, ImagePlus } from "lucide-react";
import { useState } from "react";

import { AccountSection } from "@/components/account/account-section";
import { formatPrice } from "@/features/02-products/utils/format-price";
import { EXCHANGE_OPTIONS, balanceOf } from "@/features/18-returns/utils/exchange";

/**
 * The customer's side of a return.
 *
 * Five steps, and the middle one is the one that matters: what they get back.
 * A voucher is just the value of the item, but an exchange is a second garment
 * at a second price — so choosing it opens the picker and the price difference
 * right there, rather than making someone commit to a swap and discover what
 * it costs on the review screen.
 *
 * The figure quoted is `balanceOf`, the same function the console approves
 * against, so what the customer is told here is what the operator sees. Every
 * answer is held in state for the same reason: the review step has to show
 * what was actually chosen, not what the form was pre-filled with.
 */

/* Five, not six. "Quantity" was a step with one option on it — a question that
   could only be answered one way is not a question, it is a click. */
const STEPS = ["Item", "Reason", "What you get", "Pickup", "Review"];

/** The one item this order has that is still inside its return window. */
const RETURNING = {
  order: "IO-2026-1027",
  name: "Bone Utility Overshirt",
  variant: "Bone / L",
  label: "Bone Utility Overshirt · L",
  value: 11400,
  delivered: "18 Jul",
};

const REASONS = [
  { value: "Size or fit", note: "Too small, too large, or fit differs" },
  { value: "Quality concern", note: "Photos will be required" },
  { value: "Changed my mind", note: "Item must remain unworn" },
];

/**
 * Two outcomes, because money does not go back to a card.
 *
 * A settled return issues a voucher for the value, straight onto the account —
 * which is also how an exchange settles when the replacement is cheaper. There
 * is no third option that quietly means the same thing as the first.
 */
const OUTCOMES = [
  {
    value: "Voucher",
    note: `${formatPrice(RETURNING.value)} onto your account, to spend whenever you like`,
  },
  { value: "Exchange", note: "Swap it for another size or another piece" },
];

const SLOTS = ["07 Aug · 10:00–14:00", "08 Aug · 14:00–18:00"];

/* Swapping a garment for the very same size is not an exchange, so the size
   going back is not on the list of sizes that can come out. */
const REPLACEMENTS = EXCHANGE_OPTIONS.filter((option) => option.value !== RETURNING.label);

export function ReturnWizard() {
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);

  const [reason, setReason] = useState(REASONS[0].value);
  const [outcome, setOutcome] = useState(OUTCOMES[0].value);
  const [replacement, setReplacement] = useState(REPLACEMENTS[0].value);
  const [slot, setSlot] = useState(SLOTS[0]);

  const swap = outcome === "Exchange";
  const balance = balanceOf(RETURNING.value, replacement);

  /** What was chosen, in one line — the review step and the receipt share it. */
  const outcomeLine = swap
    ? `Exchange for ${replacement}`
    : `${outcome} · ${formatPrice(RETURNING.value)}`;

  if (complete)
    return (
      <AccountSection
        copy="Nothing has been collected or charged yet. We check the item when it reaches us, and you can cancel any time before the pickup."
        eyebrow="Returns / Request raised"
        title="That's with us."
      >
        <div className="account-notice account-notice--large">
          <Check size={22} />
          <p>
            <strong>{outcomeLine}</strong>
            <small>
              {swap
                ? `${balance.customerSentence} Your courier comes ${slot}.`
                : `We collect ${RETURNING.name} on ${slot}, and your voucher lands on the account as soon as it reaches us.`}
            </small>
          </p>
        </div>
      </AccountSection>
    );

  return (
    <AccountSection
      copy="Tell us what is coming back and what you would like instead. Prices shown are the ones we hold you to."
      eyebrow="Returns / New request"
      title="Start a return."
    >
      <ol aria-label="Return progress" className="return-progress">
        {STEPS.map((label, index) => (
          <li
            className={index === step ? "is-current" : index < step ? "is-complete" : ""}
            key={label}
          >
            <span>{index < step ? <Check size={13} /> : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>

      <section className="return-step-card">
        {step === 0 && (
          <fieldset>
            <legend>Eligible items</legend>
            <label className="return-option">
              <input defaultChecked type="checkbox" />
              <span>
                <strong>{RETURNING.name}</strong>
                <small>
                  {RETURNING.variant} · {RETURNING.order} · delivered {RETURNING.delivered}
                </small>
              </span>
              <b>{formatPrice(RETURNING.value)}</b>
            </label>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend>Why is it going back?</legend>
            <div className="return-option-grid">
              {REASONS.map((entry) => (
                <label className="return-option" key={entry.value}>
                  <input
                    checked={reason === entry.value}
                    name="reason"
                    onChange={() => setReason(entry.value)}
                    type="radio"
                  />
                  <span>
                    <strong>{entry.value}</strong>
                    <small>{entry.note}</small>
                  </span>
                </label>
              ))}
            </div>
            <label className="return-upload">
              <ImagePlus size={20} />
              <span>
                <strong>Add evidence</strong>
                <small>Up to five JPG, PNG, or WebP images</small>
              </span>
              <input accept="image/jpeg,image/png,image/webp" multiple type="file" />
            </label>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend>Choose an outcome</legend>
            <div className="return-option-grid">
              {OUTCOMES.map((entry) => (
                <label className="return-option" key={entry.value}>
                  <input
                    checked={outcome === entry.value}
                    name="outcome"
                    onChange={() => setOutcome(entry.value)}
                    type="radio"
                  />
                  <span>
                    <strong>{entry.value}</strong>
                    <small>{entry.note}</small>
                  </span>
                </label>
              ))}
            </div>

            {/* The consequence of the choice, next to the choice. Picking a
                replacement is what sets the price difference, so the figure
                moves as the list does rather than appearing two steps later. */}
            {swap && (
              <>
                <label className="return-field" style={{ marginTop: 18 }}>
                  Swap it for
                  <select onChange={(event) => setReplacement(event.target.value)} value={replacement}>
                    {REPLACEMENTS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value} — {formatPrice(option.price)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="account-notice">
                  <ArrowLeftRight size={20} />
                  <p>
                    <strong>
                      {balance.short} · {balance.label}
                    </strong>
                    <small>
                      {balance.customerSentence} Only sizes we have in stock are listed, and nothing
                      is charged or credited until your item reaches us.
                    </small>
                  </p>
                </div>
              </>
            )}
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <legend>Reverse pickup</legend>
            {SLOTS.map((entry) => (
              <label className="return-option" key={entry}>
                <input
                  checked={slot === entry}
                  name="pickup"
                  onChange={() => setSlot(entry)}
                  type="radio"
                />
                <span>
                  <strong>{entry}</strong>
                  <small>Saved address · New Delhi, Delhi</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 4 && (
          <div className="return-review">
            <div>
              <span>Going back</span>
              <strong>
                {RETURNING.name} · {RETURNING.variant} · {formatPrice(RETURNING.value)}
              </strong>
            </div>
            <div>
              <span>Reason</span>
              <strong>{reason}</strong>
            </div>
            <div>
              <span>You get</span>
              <strong>{outcomeLine}</strong>
            </div>
            {swap && (
              <div>
                <span>{balance.label}</span>
                <strong>{balance.short}</strong>
              </div>
            )}
            <div>
              <span>Pickup</span>
              <strong>{slot}</strong>
            </div>
            <p>
              {swap
                ? balance.customerSentence
                : `${formatPrice(RETURNING.value)} goes onto your account as a voucher once we have checked the item — it does not go back to a card.`}{" "}
              We confirm stock and your pickup slot when the request is submitted.
            </p>
          </div>
        )}

        <div className="return-step-actions">
          <button
            className="button button--secondary"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            type="button"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            className="button button--primary"
            onClick={() =>
              step === STEPS.length - 1 ? setComplete(true) : setStep((value) => value + 1)
            }
            type="button"
          >
            {step === STEPS.length - 1 ? "Raise this return" : "Continue"}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </AccountSection>
  );
}
