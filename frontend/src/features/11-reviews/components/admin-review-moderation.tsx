"use client";

import { Eye, EyeOff, MessageSquare, Star } from "lucide-react";
import { useCallback, useMemo } from "react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Note, Section } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { useRegister } from "@/api/use-register";
import { resetPublishedReviews } from "@/features/11-reviews/reviews-context";
import {
  REVIEW_STATES,
  asReview,
  averageRating,
  countByState,
  publishedReviews,
} from "@/features/11-reviews/reviews";

/**
 * The review desk.
 *
 * Nothing here approves anything. A review is live on its product page from the
 * moment a shopper writes it — see migration 0022 — so this screen is not a
 * queue standing between a customer and being heard. It is where a review is
 * corrected, taken down, or removed.
 *
 * Three verbs, and the difference between them is the whole design:
 *
 *   Edit    the review stays up, with a phone number or a surname taken out of
 *           it. The reviewer's verdict is untouched.
 *   Hide    it comes off the storefront and can be put back. Recorded in
 *           `review_moderation_history`, so the decision is answerable.
 *   Delete  it never existed. For spam and for erasure requests, and it frees
 *           the shopper to write about that piece again.
 *
 * Reaching for the third when the second would do is the mistake this screen is
 * laid out to discourage, which is why delete sits last and behind a
 * confirmation.
 */

const COLUMNS: Column[] = [
  { key: "product", label: "Review", primary: true, sub: "headline" },
  {
    key: "rating",
    label: "Rating",
    align: "center",
    numeric: true,
    /* Drawn as the five stars a shopper actually tapped rather than as a
       numeral: a desk scanning forty rows reads a shape faster than a digit,
       and the number a review was given is the first thing that has to be
       obvious when the words underneath it disagree with it. */
    render: (row) => <RatingCell value={row.rating} />,
    exportValue: (row) => row.rating ?? "",
  },
  { key: "customer", label: "Customer", hideSmall: true },
  { key: "fit", label: "Fit", hideSmall: true },
  { key: "submitted", label: "Submitted", align: "right", hideSmall: true },
  { key: "status", label: "On the shop", status: true },
];

/** `★★★☆☆` — the rating as a shape, with the numeral for anything reading it. */
function RatingCell({ value }: { value?: string }) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 1) return <span>—</span>;

  return (
    <span aria-label={`${score} out of 5`} className="aui-stars">
      <span aria-hidden>{"★".repeat(score)}</span>
      <span aria-hidden className="aui-stars__rest">
        {"★".repeat(5 - score)}
      </span>
    </span>
  );
}

/**
 * What the form asks for — and, as importantly, what it does not. The id is
 * minted internally and the date is stamped on save, so the only things typed
 * are the things a person actually knows.
 */
/**
 * What a console-written review is asked for.
 *
 * No `status` field. Whether a review is on the shop is the verb on its row —
 * hide or put back — each of which is its own endpoint that also writes a
 * moderation history entry. A dropdown in the form would be a third way to set
 * it that recorded nothing, and a console-written review goes up like any other.
 */
const FIELDS: FormField[] = [
  /**
   * The piece the review is about.
   *
   * Create-only. Re-pointing an existing review at a different product would
   * carry somebody's words onto a garment they never bought — and past the
   * one-review-per-customer key on the way, since that key is (customer,
   * product). The API refuses it for the same reason; this keeps the box off
   * the edit form rather than letting an operator type into a field that will
   * be ignored.
   */
  {
    key: "product",
    label: "Product",
    placeholder: "Afterdark Hoodie",
    required: true,
    createOnly: true,
    help: "The slug or the name. A review cannot be moved to a different piece later.",
  },
  { key: "rating", label: "Rating", type: "select", options: ["5", "4", "3", "2", "1"] },
  { key: "customer", label: "Customer", placeholder: "A•••• K••••", required: true },
  {
    key: "fit",
    label: "Fit",
    type: "select",
    options: ["", "Runs small", "True to size", "Runs large"],
    help: "What the shopper answered, where they answered it.",
  },
  { key: "headline", label: "Headline", placeholder: "Built like an outer layer should be.", full: true, required: true },
  {
    key: "body",
    label: "What they said",
    type: "textarea",
    full: true,
    placeholder: "The canvas has real structure without fighting movement…",
    help: "Correct what breaks policy — a name, a phone number, an obscenity. Not what the reviewer meant.",
  },
];

export function AdminReviewModeration() {
  /**
   * Every review, from `/admin/reviews` — not the shopper-facing context, which
   * can only see the live ones. The desk needs the hidden ones too — a review it
   * cannot see is one it cannot put back.
   */
  const register = useRegister(
    useMemo(
      () => ({
        path: "/admin/reviews",
        itemPath: (row: RecordRow) => `/admin/reviews/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({
          product: values.product,
          rating: Number(values.rating ?? 5) || 5,
          customer: values.customer,
          headline: values.headline,
          body: values.body ?? "",
        }),
        /* DELETE /admin/reviews/{id}. Real, not a flag — see the repository. */
        /**
         * A correction, and only that.
         *
         * No `status` and no `product` — the API takes neither. Whether a review
         * is on the shop is moved by the verb on its row, which writes a
         * moderation history entry; an edit that could also put a hidden review
         * back would be a way to undo a take-down without recording that anybody
         * had.
         */
        toUpdate: (values: RecordRow) => ({
          rating: Number(values.rating ?? 5) || 5,
          customer: values.customer,
          headline: values.headline,
          body: values.body ?? "",
          fit: values.fit ?? "",
        }),
      }),
      [],
    ),
  );

  const reviews = useMemo(() => register.rows.map(asReview), [register.rows]);
  /* The average a shopper sees is the average of what a shopper can see. */
  const liveReviews = useMemo(() => publishedReviews(reviews), [reviews]);

  /**
   * A decision, and the storefront told about it.
   *
   * Approving publishes: the home page and every product page read
   * `GET /reviews`, so the held copy of that list is dropped and re-read rather
   * than left showing what was live before this click.
   */
  const decide = useCallback(
    async (id: string, verb: "hide" | "publish") => {
      await register.act(`/admin/reviews/${encodeURIComponent(id)}/${verb}`);
      resetPublishedReviews();
    },
    [register],
  );

  /**
   * Removing one outright.
   *
   * Goes through the register's own delete so the row leaves the table on the
   * server's answer rather than on the click, and drops the storefront's held
   * copy for the same reason an edit does — a deleted review must not go on
   * being quoted on a product page.
   */
  const remove = useCallback(
    async (row: RecordRow) => {
      await register.onDelete(row);
      resetPublishedReviews();
    },
    [register],
  );

  /**
   * An edit is also a change to the SHOP.
   *
   * A live review is quoted on its product page, so correcting one has to drop
   * the held copy of the public list — otherwise the storefront goes on showing
   * the phone number that was just taken out of it. Same move `decide` makes,
   * for the same reason.
   */
  const edit = useCallback(
    async (values: RecordRow, previous: RecordRow) => {
      await register.onUpdate(values, previous);
      resetPublishedReviews();
    },
    [register],
  );

  const published = countByState(reviews, "Published");
  const hidden = countByState(reviews, "Hidden");
  const average = averageRating(liveReviews);

  const stats: Stat[] = [
    {
      label: "Live on the shop",
      value: String(published).padStart(2, "0"),
      icon: Eye,
      tone: "mint",
      note: "Showing on their product pages",
    },
    {
      label: "Taken down",
      value: String(hidden).padStart(2, "0"),
      icon: EyeOff,
      tone: hidden > 0 ? "amber" : "violet",
      note: hidden > 0 ? "Hidden by this desk" : "Nothing hidden",
    },
    {
      label: "Total written",
      value: String(reviews.length).padStart(2, "0"),
      icon: MessageSquare,
      tone: "sky",
      note: "Every review the shop has had",
    },
    {
      label: "Average rating",
      /* Across the LIVE ones, because that is the number the storefront shows.
         Counting a hidden review into it would make this figure disagree with
         every product page. */
      value: average === 0 ? "—" : average.toFixed(1),
      icon: Star,
      tone: "violet",
      note: `Across ${published} live ${published === 1 ? "review" : "reviews"}`,
    },
  ];

  return (
    <AdminPage
      eyebrow="Reviews · Moderation"
      icon={Star}
      lede="Reviews go up as they are written. Moderate against policy, not sentiment — a two-star review that follows the rules stays exactly where a five-star one does."
      spec={[
        { label: "Live", value: String(published).padStart(2, "0") },
        { label: "Hidden", value: String(hidden).padStart(2, "0") },
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
        copy="Every review the shop has received. Correct one, take it down, or remove it outright."
        eyebrow="Register"
        title="All reviews"
      >
        <RecordManager
          columns={COLUMNS}
          emptyHint="Nothing has been written yet. Add one here, or wait for a shopper to review a piece they bought."
          error={register.error}
          fields={FIELDS}
          filterKey="status"
          filterValues={[...REVIEW_STATES]}
          icon={Star}
          loaded={register.loaded}
          loading={register.loading}
          onCreate={register.onCreate}
          /**
           * All three verbs, and they are genuinely different answers.
           *
           * Editing keeps a fair review up with the phone number taken out of
           * it — which is what the desk actually needs most often, and what it
           * had no way to do while the only answer to "unpublishable in detail"
           * was rejecting the whole thing. Doing that to a three-star review
           * silently rounds the shop's rating up, which is the opposite of what
           * moderation is for.
           *
           * Hiding is the reversible take-down, and it is what to reach for
           * nearly every time. Deleting is not a stronger hide: it is for a
           * record that should not exist, and it releases the shopper to write
           * about that piece again.
           */
          onUpdate={edit}
          onDelete={remove}
          rows={register.rows}
          searchKeys={["product", "customer", "headline", "body", "status", "fit"]}
          singular="review"
          tone="amber"
          rowAction={(row) => decisionsFor(row, decide)}
        >
          <Note icon={Eye} title="Everything here is already live.">
            A review is on its product page from the moment it is written. Hiding
            takes one off and can be undone; deleting removes it for good and lets
            that shopper write about the piece again.
          </Note>
        </RecordManager>
      </Section>
    </AdminPage>
  );
}

/**
 * The one verb a row is offered — never one that would do nothing.
 *
 * A live review can only be taken down and a hidden one can only be put back,
 * so the row carries whichever of the two actually changes something. Editing
 * and deleting are the register's own controls beside it.
 */
function decisionsFor(
  row: RecordRow,
  decide: (id: string, verb: "hide" | "publish") => Promise<void>,
) {
  if (row.status === "Hidden") {
    return [
      {
        icon: Eye,
        tone: "good" as const,
        label: `Put this ${row.product} review back on the shop`,
        onSelect: () => decide(row.id, "publish"),
        toast: {
          title: "Review is live again",
          description: `It is back on the ${row.product} page under ${row.customer || "the shopper"}.`,
        },
      },
    ];
  }

  return [
    {
      icon: EyeOff,
      tone: "danger" as const,
      label: `Hide this ${row.product} review`,
      onSelect: () => decide(row.id, "hide"),
      toast: {
        title: "Review hidden",
        description: "It is off the storefront. You can put it back at any time.",
      },
    },
  ];
}
