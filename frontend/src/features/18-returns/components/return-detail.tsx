import { ArrowLeftRight, Check, Circle, RotateCcw } from "lucide-react";
import Link from "next/link";

import { AccountSection } from "@/components/account/account-section";
import { useCatalog } from "@/features/02-products";
import { formatPrice } from "@/features/02-products/utils/format-price";
import type { CustomerReturn } from "@/features/18-returns/customer-returns";
import { balanceOf, replacementPrice } from "@/features/18-returns/utils/exchange";

/**
 * One return, as the customer sees it.
 *
 * The three questions someone checks this page to answer are what is going
 * back, what they get instead, and when — so those are the three things on it,
 * in that order. On an exchange the second question has a price attached, and
 * the figure quoted here is the same one the console approves: both read
 * `balanceOf` over the same live catalogue, so neither can quote the other's
 * customer a different number.
 */
export function ReturnDetail({ item }: { item: CustomerReturn }) {
  /* The replacement is priced at what it sells for TODAY, so the figure comes
     from the live catalogue rather than from anything stored on the return. */
  const { data: catalogue } = useCatalog();

  const settled = item.status === "Voucher issued" || item.status === "Exchange on its way";
  const swap = item.outcome === "Exchange" && Boolean(item.replacement);
  const balance = swap ? balanceOf(item.amount, item.replacement, catalogue) : null;

  return (
    <AccountSection
      copy={`${item.item} · ${item.variant}`}
      eyebrow="Return / Reverse logistics"
      title={item.id.toUpperCase()}
    >
      <div className="account-detail-grid">
        <article>
          {swap ? <ArrowLeftRight size={18} /> : <RotateCcw size={18} />}
          <h2>{swap ? "Your exchange" : "Return facts"}</h2>
          <dl>
            <div>
              <dt>Order</dt>
              <dd>{item.order}</dd>
            </div>
            <div>
              <dt>Going back</dt>
              <dd>
                {item.item} · {formatPrice(item.amount)}
              </dd>
            </div>
            {swap ? (
              <>
                <div>
                  <dt>Coming to you</dt>
                  <dd>
                    {item.replacement} ·{" "}
                    {formatPrice(replacementPrice(item.replacement, catalogue))}
                  </dd>
                </div>
                <div>
                  <dt>{balance?.label}</dt>
                  <dd>{balance?.short}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>Outcome</dt>
                  <dd>{item.outcome}</dd>
                </div>
                <div>
                  <dt>Goes to</dt>
                  <dd>{item.destination}</dd>
                </div>
              </>
            )}
          </dl>
        </article>

        <article>
          <p className="eyebrow">{swap ? "The difference" : "Your voucher"}</p>
          <h2>{swap ? "What you owe, or what you get." : "Spend it whenever you like."}</h2>
          <p>
            {balance
              ? `${balance.customerSentence} It settles when your exchange is sent, not before — if the return is turned down, nothing moves either way.`
              : settled
                ? `We do not send money back to a card. The value of this return is on your account as a voucher, and whatever you do not spend stays on it.`
                : "Once the item reaches us we issue a voucher for its value, straight onto your account."}
          </p>
          <strong className="account-reference">{swap ? balance?.short : item.reference}</strong>
          {!swap && settled && (
            <Link className="io-btn io-btn--ghost" href="/account/vouchers">
              Open your vouchers
            </Link>
          )}
        </article>
      </div>

      <div className="account-order-timeline">
        <div className="is-complete">
          <Check size={15} />
          <p>
            <strong>Request approved</strong>
            <small>Eligibility and evidence accepted</small>
          </p>
        </div>
        <div className="is-complete">
          <Check size={15} />
          <p>
            <strong>Pickup</strong>
            <small>
              {settled ? "Item collected and checked" : "Courier booked · we check it on arrival"}
            </small>
          </p>
        </div>
        <div className={settled ? "is-complete" : ""}>
          {settled ? <Check size={15} /> : <Circle size={15} />}
          <p>
            <strong>
              {swap
                ? settled
                  ? `${item.replacement} sent`
                  : `${item.replacement} reserved`
                : settled
                  ? "Voucher issued"
                  : "Voucher on the way"}
            </strong>
            <small>
              {swap
                ? balance?.customerSentence
                : settled
                  ? `${formatPrice(item.amount)} on your account as ${item.destination}`
                  : "Issued as soon as your item reaches us"}
            </small>
          </p>
        </div>
      </div>
    </AccountSection>
  );
}
