"use client";

import { Check, Eye, ShieldAlert, Star, X } from "lucide-react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Note, Section } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { useReviews } from "@/features/11-reviews/reviews-context";
import {
  REVIEW_STATES,
  asReview,
  averageRating,
  countByState,
  reviewStamp,
} from "@/features/11-reviews/reviews";

/**
 * Review moderation.
 *
 * The screen used to open on one hard-coded review pinned above the queue, with
 * its own approve/reject verbs in the masthead — which meant the buttons at the
 * top of the page and the rows underneath them were talking about different
 * records. It is one register now: every review in the list, and the decision
 * made on the row it belongs to.
 *
 * The decision is the whole screen. Approving publishes the review to the
 * storefront home page; anything else keeps it here.
 */

const COLUMNS: Column[] = [
  { key: "product", label: "Review", primary: true, sub: "headline" },
  {
    key: "rating",
    label: "Rating",
    align: "center",
    numeric: true,
    render: (row) => `${row.rating} ★`,
    exportValue: (row) => row.rating ?? "",
  },
  { key: "customer", label: "Customer", hideSmall: true },
  { key: "submitted", label: "Submitted", align: "right", hideSmall: true },
  { key: "status", label: "Decision", status: true },
];

/**
 * What the form asks for — and, as importantly, what it does not. The id is
 * minted internally and the date is stamped on save, so the only things typed
 * are the things a person actually knows.
 */
const FIELDS: FormField[] = [
  { key: "product", label: "Product", placeholder: "Afterdark Hoodie", required: true },
  { key: "rating", label: "Rating", type: "select", options: ["5", "4", "3", "2", "1"] },
  { key: "customer", label: "Customer", placeholder: "A•••• K••••" },
  { key: "status", label: "Decision", type: "select", options: [...REVIEW_STATES] },
  { key: "headline", label: "Headline", placeholder: "Built like an outer layer should be.", full: true },
  {
    key: "body",
    label: "What they said",
    type: "textarea",
    placeholder: "The canvas has real structure without fighting movement…",
  },
];

export function AdminReviewModeration() {
  const { reviews, setAll } = useReviews();

  const pending = countByState(reviews, "Pending");
  const approved = countByState(reviews, "Approved");
  const rejected = countByState(reviews, "Rejected");
  const average = averageRating(reviews);

  const stats: Stat[] = [
    {
      label: "Waiting on you",
      value: String(pending).padStart(2, "0"),
      icon: ShieldAlert,
      tone: "amber",
      note: "Nobody sees these yet",
    },
    {
      label: "Approved · live",
      value: String(approved).padStart(2, "0"),
      icon: Check,
      tone: "mint",
      note: "Showing on the home page",
    },
    {
      label: "Rejected",
      value: String(rejected).padStart(2, "0"),
      icon: X,
      tone: "rose",
      note: "Closed, never published",
    },
    {
      label: "Average rating",
      value: average === 0 ? "—" : average.toFixed(1),
      icon: Star,
      tone: "violet",
      note: `Across ${reviews.length} reviews`,
    },
  ];

  return (
    <AdminPage
      eyebrow="Reviews · Moderation"
      icon={Star}
      lede="Moderate against policy, not sentiment. A two-star review that follows the rules is published exactly like a five-star one."
      spec={[
        { label: "Pending", value: String(pending).padStart(2, "0") },
        { label: "Approved", value: String(approved).padStart(2, "0") },
        { label: "Average", value: average === 0 ? "—" : average.toFixed(1) },
      ]}
      title={
        <>
          Review <em>desk</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <Section
        copy="Every review the shop has received, and the one decision each of them needs."
        eyebrow="Queue"
        title="All reviews"
      >
        <RecordManager
          columns={COLUMNS}
          emptyHint="Nothing has been written yet. Add one here, or wait for a shopper to send feedback from their account."
          fields={FIELDS}
          filterKey="status"
          filterValues={[...REVIEW_STATES]}
          icon={Star}
          /* The form does not collect an id, so the register mints one and
             nothing on screen ever shows it. */
          idPrefix="REV"
          onCommit={(next) => setAll((current) => next(current).map(asReview))}
          rows={reviews}
          searchKeys={["product", "customer", "headline", "body", "status"]}
          singular="review"
          tone="amber"
          /* Fills in what the form deliberately does not ask for: the id, which
             is internal, and the date, which is today by definition on a new
             record and must not move on an edit. */
          derive={(values, _rows, previous) => ({
            ...values,
            submitted: previous?.submitted || reviewStamp(new Date()),
          })}
          rowAction={(row) => decisionsFor(row)}
        >
          <Note icon={Eye} title="Approve is publish.">
            An approved review is quoted on the storefront home page straight
            away. Pending and rejected ones never leave this desk.
          </Note>
        </RecordManager>
      </Section>
    </AdminPage>
  );
}

/**
 * The verbs a row is offered — never one that would do nothing.
 *
 * An approved review keeps only "take down", a rejected one keeps only
 * "approve", and anything still waiting gets both, so the button on the row is
 * always the move that changes something.
 */
function decisionsFor(row: RecordRow) {
  const approve = {
    icon: Check,
    tone: "good" as const,
    label: `Approve this ${row.product} review`,
    patch: { status: "Approved" },
    toast: {
      title: "Review approved",
      description: `It is now showing on the home page under ${row.customer || "the shopper"}.`,
    },
  };

  const reject = {
    icon: X,
    tone: "danger" as const,
    label: `Reject this ${row.product} review`,
    patch: { status: "Rejected" },
    toast: {
      title: "Review rejected",
      description: "It is closed and will not appear anywhere on the storefront.",
    },
  };

  if (row.status === "Approved") return [reject];
  if (row.status === "Rejected") return [approve];
  return [approve, reject];
}
