"use client";

import {
  ArrowLeftRight,
  BadgeIndianRupee,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Note, type StatusTone } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { formatPrice } from "@/features/02-products/utils/format-price";
import {
  AWAITING_PAYMENT,
  EXCHANGE,
  NO_REPLACEMENT,
  RETURN_REASONS,
  RETURN_STATES,
  VOUCHER,
} from "@/features/18-returns/data/admin-return-fixtures";
import { mintReturnId, useReturnsRegister } from "@/features/18-returns/data/returns-store";
import {
  EXCHANGE_OPTIONS,
  balanceOf,
  replacementPrice,
} from "@/features/18-returns/utils/exchange";
import { useVouchers } from "@/features/10-coupons/vouchers-context";

/**
 * The returns screens — two of them, and a record is only ever on one.
 *
 * `/requests` is the returns that want their money back as store credit.
 * `/exchanges` is the returns that want a different garment. They are the same
 * register read through the one question the customer already answered, so
 * nobody has to filter an exchange out of a list of refunds to see either.
 *
 * Because the tab decides the outcome, the form never asks for it: a record
 * raised on Returns is a voucher return and a record raised on Exchanges is an
 * exchange, and there is no combination of answers that can put one on the
 * wrong screen.
 *
 * Nothing about the money is typed in either. Every figure below — what is
 * collected, what is credited, what is settled — is worked out from the two
 * prices by `balanceOf` and acted on by the buttons themselves. The operator
 * says only whether the return is genuine; the arithmetic and its consequences
 * are the screen's job.
 */

export type ReturnsView = "requests" | "exchanges";

const money = (value: string | number) => formatPrice(Number(value) || 0);

const pad = (value: number) => String(value).padStart(2, "0");

/** Still owed one way or the other — a closed return owes nothing. */
const OPEN = new Set(["New", AWAITING_PAYMENT, "Approved"]);

/**
 * What settling this return puts on the customer's account, in rupees.
 *
 * A voucher return is worth what they paid. An exchange is worth the price
 * difference, and only when the difference runs their way — a pricier
 * replacement is money coming IN, which is not a credit at all.
 */
function creditFor(row: RecordRow) {
  if (row.outcome !== EXCHANGE) return Number(row.amount) || 0;
  if (!row.replacement) return 0;

  const balance = balanceOf(row.amount, row.replacement);
  return balance.direction === "credit" ? Math.abs(balance.difference) : 0;
}

/** What the customer has to pay before a pricier swap can ship, in rupees. */
function dueFor(row: RecordRow) {
  if (row.outcome !== EXCHANGE || !row.replacement) return 0;

  const balance = balanceOf(row.amount, row.replacement);
  return balance.direction === "collect" ? balance.difference : 0;
}

/** Amber on the two states that are waiting on somebody. */
const STATE_TONE: Record<string, StatusTone> = {
  New: "warn",
  [AWAITING_PAYMENT]: "warn",
  Approved: "info",
  Completed: "good",
  Rejected: "bad",
};

/** The two-line table cell: the thing, and the quiet fact about it. */
function stacked(title: string, note: string) {
  return (
    <span className="aui-table__primary">
      <strong>{title}</strong>
      <small>{note}</small>
    </span>
  );
}

/* ====================================================== returns columns */

/* Four columns. The price rides under the item it belongs to rather than
   taking a column of its own, and the reason lives on the record — nobody
   scans a list of returns looking for "size / fit". Nor is there an outcome
   column: every row on this screen has the same one. */
const RETURN_COLUMNS: Column[] = [
  { key: "id", label: "Return", primary: true, sub: "order" },
  { key: "customer", label: "Customer" },
  {
    key: "item",
    label: "Coming back",
    render: (row) => stacked(row.item, money(row.amount)),
    exportValue: (row) => `${row.item} (${money(row.amount)})`,
  },
  {
    key: "amount",
    label: "Voucher due",
    align: "right",
    numeric: true,
    render: (row) => money(row.amount),
    exportValue: (row) => row.amount,
  },
  { key: "state", label: "Status", status: true },
];

/* ===================================================== exchanges columns */

const EXCHANGE_COLUMNS: Column[] = [
  { key: "id", label: "Return", primary: true, sub: "customer" },
  {
    key: "item",
    label: "Sending back",
    render: (row) => stacked(row.item, money(row.amount)),
    exportValue: (row) => `${row.item} (${money(row.amount)})`,
  },
  {
    key: "replacement",
    label: "In exchange for",
    render: (row) =>
      row.replacement
        ? stacked(row.replacement, money(replacementPrice(row.replacement)))
        : stacked("Not chosen yet", "Waiting on the customer"),
    exportValue: (row) =>
      row.replacement ? `${row.replacement} (${money(replacementPrice(row.replacement))})` : "",
  },
  {
    key: "balance",
    label: "Difference",
    align: "right",
    numeric: true,
    /* The figure, and what has already been done about it — a swap sitting in
       `Awaiting payment` has had its request raised, and one that is past it
       has been paid. The column therefore reads as a running account of the
       money rather than a sum anyone still has to act on. */
    render: (row) => {
      if (!row.replacement) return "—";
      const balance = balanceOf(row.amount, row.replacement);
      return stacked(balance.short, settlementNote(row, balance.direction));
    },
    exportValue: (row) =>
      row.replacement ? `${balanceOf(row.amount, row.replacement).short}` : "",
  },
  { key: "state", label: "Status", status: true },
];

/** Where the price difference has got to, for the row it sits on. */
function settlementNote(row: RecordRow, direction: "collect" | "credit" | "even") {
  if (row.state === "Rejected") return "Closed · nothing moved";
  if (direction === "even") return "Nothing due either way";

  if (direction === "collect") {
    if (row.state === "New") return "Requested on approval";
    if (row.state === AWAITING_PAYMENT) return "Requested · not paid yet";
    return "Paid by the customer";
  }

  return row.state === "Completed" ? "Credited as a voucher" : "Credited on settlement";
}

/* ================================================================= form */

/**
 * Five questions on Returns, six on Exchanges, and none of them is about money
 * moving or about state.
 *
 * The id is minted rather than asked for — nobody types a return number. The
 * outcome is not asked for because the tab is the answer. The status is not
 * asked for because the buttons on the row move a return along, and a dropdown
 * that could do the same thing is a second way to do one job. What is left is
 * only the facts of the return itself.
 */
function fieldsFor(view: ReturnsView): FormField[] {
  const shared: FormField[] = [
    { key: "order", label: "Order number", placeholder: "IO-2026-1049", required: true },
    { key: "customer", label: "Customer", placeholder: "Aarav Mehta", required: true },
    { key: "item", label: "Item coming back", placeholder: "Afterdark Hoodie · M", required: true },
    { key: "amount", label: "What they paid (₹)", type: "number", placeholder: "11400" },
    { key: "reason", label: "Why is it coming back?", type: "select", options: RETURN_REASONS },
  ];

  if (view !== "exchanges") return shared;

  return [
    ...shared,
    {
      key: "replacement",
      label: "Item going out instead",
      type: "select",
      /* Sold-out sizes are not on the list, so nobody can promise a
         replacement that is not on the shelf. */
      options: EXCHANGE_OPTIONS.map((option) => ({
        value: option.value,
        label: `${option.value} — ${formatPrice(option.price)}`,
      })),
      required: true,
      help: "The price difference is worked out from this and settled by itself — nothing to calculate.",
      full: true,
    },
  ];
}

/* =============================================================== screen */

export function AdminReturnsWorkspace({ view = "requests" }: { view?: ReturnsView }) {
  const exchanges = view === "exchanges";
  const { returns: all, commit, patch } = useReturnsRegister();
  const { issue } = useVouchers();

  /**
   * Closing a return: the state moves on, the replacement goes out, and any
   * credit is minted — in one press, with nothing to choose.
   *
   * This goes through the register's `onSelect` rather than its `patch`,
   * because the consequence reaches past the row: a voucher lands in the
   * customer's account and is spendable from that moment. No undo is offered
   * for the same reason — money that has been issued has been issued, and
   * `issue` is idempotent per return so a second press cannot mint a second
   * one either.
   */
  const settle = useCallback(
    (row: RecordRow) => {
      patch(row.id, { state: "Completed" });

      const credit = creditFor(row);
      const swap = row.outcome === EXCHANGE;

      if (credit <= 0) {
        toast.success(swap ? "Replacement sent" : "Return settled", {
          description: swap
            ? `${row.id} · ${row.replacement} is on its way to ${row.customer}. Nothing further is owed either way.`
            : `${row.id} was closed with nothing left to settle.`,
        });
        return;
      }

      const voucher = issue({
        returnId: row.id,
        customer: row.customer,
        amount: credit,
        reason: swap ? `Price difference · ${row.item} → ${row.replacement}` : row.item,
      });

      if (!voucher) {
        toast.info("Already settled", {
          description: `${row.id} has had its voucher issued once already.`,
        });
        return;
      }

      toast.success(`Voucher ${voucher.code} issued`, {
        description: `${money(credit)} is on ${row.customer}'s account${
          swap ? `, and ${row.replacement} is on its way` : ""
        }. They can spend it at checkout.`,
      });
    },
    [issue, patch],
  );

  /* The tab is the filter. A record answers to exactly one of these two
     questions, so no row is ever on both screens or missing from both. */
  const rows = useMemo(
    () =>
      all.filter((row) => (exchanges ? row.outcome === EXCHANGE : row.outcome !== EXCHANGE)),
    [all, exchanges],
  );

  /* Counted off the rows on screen, so a card can never disagree with the
     table under it. */
  const stats: Stat[] = useMemo(() => {
    const count = (state: string) => rows.filter((row) => row.state === state).length;

    const waiting: Stat = {
      label: "Waiting on you",
      value: pad(count("New")),
      icon: RotateCcw,
      tone: "amber",
      note: "Approve or reject these",
    };

    if (!exchanges)
      return [
        waiting,
        {
          label: "Approved",
          value: pad(count("Approved")),
          icon: PackageCheck,
          tone: "sky",
          note: "Item on its way back",
        },
        {
          label: "Settled",
          value: pad(count("Completed")),
          icon: Wallet,
          tone: "mint",
          note: "Voucher issued",
        },
      ];

    /* The money still in the air on this tab. A collection stops counting the
       moment it is paid; a credit counts until the voucher is actually minted.
       Neither total includes a rejected or completed swap, which has nothing
       left to settle. */
    const open = rows.filter((row) => OPEN.has(row.state));

    const toCollect = open
      .filter((row) => row.state === "New" || row.state === AWAITING_PAYMENT)
      .reduce((sum, row) => sum + dueFor(row), 0);

    const toCredit = open.reduce((sum, row) => sum + creditFor(row), 0);

    return [
      waiting,
      {
        label: "To collect",
        value: money(toCollect),
        icon: BadgeIndianRupee,
        tone: "sky",
        note: "Requested automatically on approval",
      },
      {
        label: "Store credit due",
        value: money(toCredit),
        icon: Wallet,
        tone: "mint",
        note: "Issued automatically on settlement",
      },
    ];
  }, [exchanges, rows]);

  return (
    /* One band of numbers, not two — the head carries the words and the cards
       carry the counts, so nothing on this screen is stated twice. */
    <AdminPage
      eyebrow={`Returns & Exchanges · ${exchanges ? "Exchanges" : "Returns"}`}
      icon={exchanges ? ArrowLeftRight : RotateCcw}
      lede={
        exchanges
          ? "Returns where the customer wants a different garment instead. Both items and the price difference are on the row, and the difference settles itself — collected before it ships, or credited back as a voucher."
          : "Returns where the customer wants the value back. Approve or reject on the row, then settle once the item is back and the voucher is issued for you."
      }
      title={
        exchanges ? (
          <>
            All <em>exchanges</em>
          </>
        ) : (
          <>
            All <em>returns</em>
          </>
        )
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        columns={exchanges ? EXCHANGE_COLUMNS : RETURN_COLUMNS}
        emptyHint={
          exchanges
            ? "No customer has asked to swap an item yet. Exchanges show up here the moment one does."
            : "No returns yet. Add one here, or wait for a customer to raise it from their account."
        }
        fields={fieldsFor(view)}
        filterKey="state"
        /* The one state only an exchange can reach is only offered where an
           exchange can be — a chip that could never read anything but zero is
           not a filter. */
        filterValues={
          exchanges ? RETURN_STATES : RETURN_STATES.filter((state) => state !== AWAITING_PAYMENT)
        }
        icon={exchanges ? ArrowLeftRight : RotateCcw}
        idPrefix="ret"
        onCommit={commit}
        rowHref={(row) => `/admin/returns/${row.id}`}
        rows={rows}
        searchKeys={["id", "order", "customer", "item", "replacement", "reason", "state"]}
        singular={exchanges ? "exchange" : "return"}
        statusTone={(row) => STATE_TONE[row.state]}
        tone="violet"
        /* Fills in what the form deliberately does not ask for. A new return
           starts `New`; an edited one keeps the state its buttons put it in,
           which is what lets the status question stay off the form entirely.

           The outcome comes from the tab, and a replacement only means
           something on an exchange — so a voucher return cannot walk away
           carrying an item it was never going to send, and neither record can
           end up on the screen it does not belong to.

           The id is minted here rather than left to the register, because the
           register can only see the tab it is on: asked for a free number while
           showing the exchanges, it would hand out one a voucher return already
           holds. `all` is the whole register, which is the only list an id can
           honestly be called free against. */
        derive={(values, _rows, previous) => ({
          ...values,
          id: previous?.id ?? mintReturnId(all),
          state: previous?.state ?? "New",
          outcome: exchanges ? EXCHANGE : VOUCHER,
          replacement: exchanges ? values.replacement : NO_REPLACEMENT,
        })}
        rowAction={(row) => {
          const swap = row.outcome === EXCHANGE;
          const due = dueFor(row);
          const credit = creditFor(row);

          /* Approving is the only judgement anyone makes on an exchange. What
             it does about the money follows from the two prices with no second
             decision: a pricier replacement raises the request for the
             difference and parks the row until it is paid; anything else goes
             straight through, because there is nothing to ask for. */
          if (row.state === "New")
            return [
              {
                icon: CheckCircle2,
                tone: "good" as const,
                label: due > 0 ? `Approve ${row.id} and request ${money(due)}` : `Approve ${row.id}`,
                patch: { state: due > 0 ? AWAITING_PAYMENT : "Approved" },
                toast: {
                  title: due > 0 ? `${money(due)} requested` : "Return approved",
                  description:
                    due > 0
                      ? `${row.id} · ${row.replacement} is reserved, and ${row.customer} has been asked for the ${money(due)} difference. It ships once that is paid.`
                      : swap
                        ? `${row.id} · ${row.replacement} is reserved. ${balanceOf(row.amount, row.replacement).sentence}`
                        : `${row.id} · the customer can send ${row.item} back.`,
                },
              },
              {
                icon: X,
                tone: "danger" as const,
                label: `Reject ${row.id}`,
                patch: { state: "Rejected" },
                toast: {
                  title: "Return rejected",
                  description: `${row.id} was closed. Open it to write the customer a reason.`,
                },
              },
            ];

          /* Money genuinely arriving from outside is the one thing this screen
             cannot know by itself, so it is the one thing it asks — as a single
             confirmation, with the figure already on it. */
          if (row.state === AWAITING_PAYMENT)
            return {
              icon: BadgeIndianRupee,
              tone: "good" as const,
              label: `${money(due)} received from ${row.customer}`,
              patch: { state: "Approved" },
              toast: {
                title: "Difference collected",
                description: `${money(due)} is in against ${row.id}. ${row.replacement} can go out now.`,
              },
            };

          /* One verb on an approved row, and it says exactly what pressing it
             does — send the replacement, issue a voucher, or both. `settle`
             writes the row and mints the credit together. */
          if (row.state === "Approved")
            return {
              icon: swap ? PackageCheck : Wallet,
              tone: "good" as const,
              label: swap
                ? credit > 0
                  ? `Send ${row.replacement} and credit ${money(credit)} to ${row.customer}`
                  : `Send ${row.replacement} to ${row.customer}`
                : `Issue a ${money(credit)} voucher to ${row.customer}`,
              onSelect: () => settle(row),
            };

          return null;
        }}
      >
        <Note icon={exchanges ? ArrowLeftRight : RotateCcw}>
          {exchanges ? (
            <>
              The price difference settles itself. Costs <strong>more</strong>? Approving asks the
              customer for the difference, and the swap ships once it is in. Costs{" "}
              <strong>less</strong>? The difference comes back as a voucher the moment you send the
              replacement. <strong>Same price</strong>? Nothing is charged and nothing is credited.
            </>
          ) : (
            <>
              <strong>Approve</strong> or <strong>reject</strong> on the row, then{" "}
              <strong>settle</strong> once the item is back. Settling issues the voucher for the
              full value by itself — money never goes back to a card.
            </>
          )}
        </Note>
      </RecordManager>
    </AdminPage>
  );
}
