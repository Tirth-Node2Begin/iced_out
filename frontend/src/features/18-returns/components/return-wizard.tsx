"use client";

import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, ImagePlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountSection } from "@/components/account/account-section";
import { useCatalog } from "@/features/02-products";
import { formatPrice } from "@/features/02-products/utils/format-price";
import { useOrders } from "@/features/07-orders/orders-context";
import { useCustomerReturns } from "@/features/18-returns/customer-returns";
import { exchangeOptions, balanceOf } from "@/features/18-returns/utils/exchange";
import { useAuth } from "@/features/20-auth-security/auth-context";

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
 *
 * What is returnable is read from THIS shopper's own delivered orders, and the
 * request is written by `POST /me/returns`. Both used to be fiction: the item was
 * a hardcoded "Bone Utility Overshirt · L" on order IO-2026-1027, and finishing
 * the wizard set a boolean. Every visitor was offered the same imaginary garment,
 * and raising a return recorded nothing anywhere.
 */

/* Five, not six. "Quantity" was a step with one option on it — a question that
   could only be answered one way is not a question, it is a click. */
const STEPS = ["Item", "Reason", "What you get", "Pickup", "Review"];

/** The reasons, if the server has not answered yet. See `useCustomerReturns`. */
const REASON_NOTES: Record<string, string> = {
  "Size or fit": "Too small, too large, or fit differs",
  "Quality concern": "Photos will be required",
  "Changed my mind": "Item must remain unworn",
};

const SLOTS = ["Morning · 10:00–14:00", "Afternoon · 14:00–18:00"];

export function ReturnWizard() {
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [sending, setSending] = useState(false);

  /* What can be swapped into comes from the live catalogue, so the picker cannot
     offer a piece that has been unpublished or a size that has sold out. Reading
     it here is also what starts the catalogue loading for this screen. */
  const { data: catalogue } = useCatalog();
  const { isAuthenticated } = useAuth();
  const { orders } = useOrders();
  const { reasons: serverReasons, raise } = useCustomerReturns(isAuthenticated);

  /**
   * What this shopper can actually send back.
   *
   * Delivered lines only — nothing in transit is returnable yet — and every line
   * carries the order it came from, because that is what the request is filed
   * against and what the server checks the caller owns.
   */
  const returnable = useMemo(
    () =>
      orders
        .filter((order) => order.status === "Delivered")
        .flatMap((order) =>
          order.lines.map((line) => ({
            key: `${order.number}-${line.id}`,
            order: order.number,
            name: line.name,
            variant: line.variant,
            /* The label the API matches an order line by: "Name · Size". */
            item: `${line.name} · ${line.variant.split("/").pop()?.trim() ?? line.variant}`,
            /* An order line's price is a FORMATTED string — "₹11,400" — because
               that is what the record shows. The exchange arithmetic needs the
               number, and the server has the authoritative figure either way. */
            value: Number((line.price ?? "").replace(/[^\d]/g, "")) || 0,
            delivered: order.date,
          })),
        ),
    [orders],
  );

  const [chosen, setChosen] = useState("");
  const RETURNING =
    returnable.find((entry) => entry.key === chosen) ?? returnable[0] ?? null;

  const REASONS = (serverReasons.length > 0 ? serverReasons : Object.keys(REASON_NOTES)).map(
    (value) => ({ value, note: REASON_NOTES[value] ?? "" }),
  );

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
      note: `${formatPrice(RETURNING?.value ?? 0)} onto your account, to spend whenever you like`,
    },
    { value: "Exchange", note: "Swap it for another size or another piece" },
  ];

  /* Swapping a garment for the very same size is not an exchange, so the size
     going back is not on the list of sizes that can come out. */
  const replacements = useMemo(
    () => exchangeOptions(catalogue).filter((option) => option.value !== RETURNING?.item),
    [catalogue, RETURNING?.item],
  );

  const [pickedReason, setPickedReason] = useState("");
  const reason =
    pickedReason && REASONS.some((entry) => entry.value === pickedReason)
      ? pickedReason
      : (REASONS[0]?.value ?? "");
  const [outcome, setOutcome] = useState(OUTCOMES[0].value);
  /* Empty until something has been picked. See `replacement` below for why that
     is not the same as "nothing is selected". */
  const [picked, setPicked] = useState("");
  const [slot, setSlot] = useState(SLOTS[0]);

  /**
   * The replacement in play: what was picked if it is still on offer, otherwise
   * the first thing that is.
   *
   * DERIVED rather than corrected in an effect. The catalogue arrives over the
   * network and can change while the wizard is open — a size selling out — and an
   * effect that reconciled state to it would be a cascading render (which this
   * repo lints against) and would also lose a pick for one frame. This cannot: it
   * is recomputed from the two things it depends on.
   */
  const replacement =
    picked && replacements.some((option) => option.value === picked)
      ? picked
      : (replacements[0]?.value ?? "");

  const swap = outcome === "Exchange";
  const balance = balanceOf(RETURNING?.value ?? 0, replacement, catalogue);

  /**
   * Raises the return on the SERVER.
   *
   * The amount is deliberately not sent: what the return is worth is the order
   * line's own price, which the API reads from the order it verified the caller
   * owns. See `ReturnController::create`.
   */
  async function raiseReturn() {
    if (!RETURNING) return;

    setSending(true);

    try {
      await raise({
        order: RETURNING.order,
        item: RETURNING.item,
        reason,
        outcome,
        ...(swap ? { replacement } : {}),
        pickup: slot,
      });

      setComplete(true);
    } catch (caught) {
      toast.error("That return could not be raised", {
        description: caught instanceof Error ? caught.message : "Try again in a moment.",
      });
    } finally {
      setSending(false);
    }
  }

  /** What was chosen, in one line — the review step and the receipt share it. */
  const outcomeLine = swap
    ? `Exchange for ${replacement}`
    : `${outcome} · ${formatPrice(RETURNING.value)}`;

  /**
   * Nothing to send back.
   *
   * Said before the wizard rather than inside it: with no delivered order there is
   * no item, no price and no exchange to quote, and every step below would be a
   * form about nothing. The old version could not reach this state because its
   * item was hardcoded.
   */
  if (!RETURNING && !complete)
    return (
      <AccountSection
        copy="A return starts from something that has already reached you."
        eyebrow="Returns / New request"
        title="Nothing to send back yet."
      >
        <div className="account-notice account-notice--large">
          <ArrowLeftRight size={22} />
          <p>
            <strong>No delivered items</strong>
            <small>
              Once an order has been delivered, its pieces can be returned from here for fourteen
              days.{" "}
              <Link className="io-link" href="/account/orders">
                Open your orders
              </Link>
              .
            </small>
          </p>
        </div>
      </AccountSection>
    );

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
                : `We collect ${RETURNING?.name ?? "your item"} on ${slot}, and your voucher lands on the account as soon as it reaches us.`}
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
            {/* A radio group over what this shopper actually had delivered, not one
                checkbox over a hardcoded garment. Radios rather than checkboxes
                because a return is raised against ONE line — the old checkbox
                could be unticked, which left the wizard with nothing selected and
                no way to say so. */}
            <div className="return-option-grid">
              {returnable.map((entry) => (
                <label className="return-option" key={entry.key}>
                  <input
                    checked={RETURNING?.key === entry.key}
                    name="item"
                    onChange={() => setChosen(entry.key)}
                    type="radio"
                  />
                  <span>
                    <strong>{entry.name}</strong>
                    <small>
                      {entry.variant} · {entry.order} · delivered {entry.delivered}
                    </small>
                  </span>
                  <b>{formatPrice(entry.value)}</b>
                </label>
              ))}
            </div>
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
                    onChange={() => setPickedReason(entry.value)}
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
                  <select onChange={(event) => setPicked(event.target.value)} value={replacement}>
                    {replacements.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value} — {formatPrice(option.price)}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Said plainly rather than shown as an empty dropdown with a
                    ₹0 difference under it: with nothing in stock there is no
                    swap to quote, and a voucher is still on offer above. */}
                {replacements.length === 0 ? (
                  <div className="account-notice">
                    <ArrowLeftRight size={20} />
                    <p>
                      <strong>Nothing available to swap into</strong>
                      <small>
                        There is nothing else in stock in another size right now. A voucher for the
                        full value is still available above.
                      </small>
                    </p>
                  </div>
                ) : (
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
                )}
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
            disabled={sending || !RETURNING}
            onClick={() => {
              if (step === STEPS.length - 1) void raiseReturn();
              else setStep((value) => value + 1);
            }}
            type="button"
          >
            {step === STEPS.length - 1 ? (sending ? "Raising…" : "Raise this return") : "Continue"}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </AccountSection>
  );
}
