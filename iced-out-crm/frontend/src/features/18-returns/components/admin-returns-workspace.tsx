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

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import { AdminPage, Note, type StatusTone } from "@/components/shell/admin-ui";
import { RecordManager, type Column, type RecordRow } from "@/components/shell/record-manager";
import { formatPrice } from "@/features/02-products/utils/format-price";
/* `NO_REPLACEMENT`, `RETURN_REASONS` and `VOUCHER` went with the create form —
   an operator no longer types a return, so nothing here needs the vocabularies a
   form would have offered. */
import {
  AWAITING_PAYMENT,
  EXCHANGE,
  RETURN_STATES,
} from "@/features/18-returns/data/admin-return-fixtures";
import { useReturnsRegister } from "@/features/18-returns/data/returns-store";
import { balanceOf, replacementPrice } from "@/features/18-returns/utils/exchange";
import { useCatalog, type Product } from "@/features/02-products";
import { ReturnsTabs } from "@/features/18-returns/components/returns-tabs";

/**
 * The returns screens — two of them, and a record is only ever on one.
 *
 * `/requests` is the returns that want their money back as store credit.
 * `/exchanges` is the returns that want a different garment. They are the same
 * register read through the one question the customer already answered, so
 * nobody has to filter an exchange out of a list of refunds to see either.
 *
 * Both are READ-ONLY registers. A return is raised by a customer against
 * something they bought; there is no form for inventing one, and the API offers
 * no endpoint for it. What an operator does is decide, and each decision is its
 * own endpoint — see `returns-store`.
 *
 * Nothing about the money is typed. Every figure below — what is collected, what
 * is credited, what is settled — is worked out from the two prices by
 * `balanceOf`, and the server does the same arithmetic when it acts on the verb
 * (`ReturnPresenter::balance`). The operator says only whether the return is
 * genuine.
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
function creditFor(row: RecordRow, catalogue: Product[]) {
  if (row.outcome !== EXCHANGE) return Number(row.amount) || 0;
  if (!row.replacement) return 0;

  const balance = balanceOf(row.amount, row.replacement, catalogue);
  return balance.direction === "credit" ? Math.abs(balance.difference) : 0;
}

/** What the customer has to pay before a pricier swap can ship, in rupees. */
function dueFor(row: RecordRow, catalogue: Product[]) {
  if (row.outcome !== EXCHANGE || !row.replacement) return 0;

  const balance = balanceOf(row.amount, row.replacement, catalogue);
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

/**
 * A factory rather than a constant: two of these columns price the replacement
 * from the live catalogue, which now arrives over the network. Built from
 * whatever the screen currently holds.
 */
function exchangeColumns(catalogue: Product[]): Column[] {
  return [
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
          ? stacked(row.replacement, money(replacementPrice(row.replacement, catalogue)))
          : stacked("Not chosen yet", "Waiting on the customer"),
      exportValue: (row) =>
        row.replacement
          ? `${row.replacement} (${money(replacementPrice(row.replacement, catalogue))})`
          : "",
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
        const balance = balanceOf(row.amount, row.replacement, catalogue);
        return stacked(balance.short, settlementNote(row, balance.direction));
      },
      exportValue: (row) =>
        row.replacement ? `${balanceOf(row.amount, row.replacement, catalogue).short}` : "",
    },
    { key: "state", label: "Status", status: true },
  ];
}

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

/* =============================================================== screen */

export function AdminReturnsWorkspace({ view = "requests" }: { view?: ReturnsView }) {
  const exchanges = view === "exchanges";
  const {
    returns: all,
    ready,
    loading,
    error,
    approve,
    reject,
    collectPayment,
    settle: settleReturn,
  } = useReturnsRegister();
  /* The replacement prices come from the live catalogue — see `exchangeColumns`. */
  const { data: catalogue } = useCatalog();

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
    async (row: RecordRow) => {
      /* The SERVER settles it — closing the return, releasing the replacement and
         issuing the voucher in one transaction, and idempotently, so a second
         press cannot mint a second voucher. This used to patch the row here and
         mint the credit through the vouchers store, which meant the two could be
         seen disagreeing: a settled return whose voucher had not been issued. */
      await settleReturn(row.id);

      const credit = creditFor(row, catalogue);
      const swap = row.outcome === EXCHANGE;

      if (credit <= 0) {
        toast.success(swap ? "Replacement sent" : "Return settled", {
          description: swap
            ? `${row.id} · ${row.replacement} is on its way to ${row.customer}. Nothing further is owed either way.`
            : `${row.id} was closed with nothing left to settle.`,
        });
        return;
      }

      toast.success("Voucher issued", {
        description: `${money(credit)} is on ${row.customer}'s account${
          swap ? `, and ${row.replacement} is on its way` : ""
        }. They can spend it at checkout.`,
      });
    },
    [catalogue, settleReturn],
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
      .reduce((sum, row) => sum + dueFor(row, catalogue), 0);

    const toCredit = open.reduce((sum, row) => sum + creditFor(row, catalogue), 0);

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
  }, [catalogue, exchanges, rows]);

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
        toolbarLead={<ReturnsTabs />}
        columns={exchanges ? exchangeColumns(catalogue) : RETURN_COLUMNS}
        emptyHint={
          exchanges
            ? "No customer has asked to swap an item yet. Exchanges show up here the moment one does."
            : "No returns yet. They arrive here when a customer raises one from their account."
        }
        error={error}
        fields={[]}
        filterKey="state"
        /* The one state only an exchange can reach is only offered where an
           exchange can be — a chip that could never read anything but zero is
           not a filter. */
        filterValues={
          exchanges ? RETURN_STATES : RETURN_STATES.filter((state) => state !== AWAITING_PAYMENT)
        }
        icon={exchanges ? ArrowLeftRight : RotateCcw}
        loaded={ready}
        loading={loading}
        readOnly
        rowHref={(row) => `/returns/detail?id=${encodeURIComponent(row.id)}`}
        rows={rows}
        searchKeys={["id", "order", "customer", "item", "replacement", "reason", "state"]}
        singular={exchanges ? "exchange" : "return"}
        statusTone={(row) => STATE_TONE[row.state]}
        tone="violet"
        rowAction={(row) => {
          const swap = row.outcome === EXCHANGE;
          const due = dueFor(row, catalogue);
          const credit = creditFor(row, catalogue);

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
                /* The server decides whether approving parks the row in
                   `Awaiting payment` or moves it straight on — it does the same
                   balance arithmetic. Sending the state from here would be this
                   screen's guess at it. */
                onSelect: () => approve(row.id),
                toast: {
                  title: due > 0 ? `${money(due)} requested` : "Return approved",
                  description:
                    due > 0
                      ? `${row.id} · ${row.replacement} is reserved, and ${row.customer} has been asked for the ${money(due)} difference. It ships once that is paid.`
                      : swap
                        ? `${row.id} · ${row.replacement} is reserved. ${balanceOf(row.amount, row.replacement, catalogue).sentence}`
                        : `${row.id} · the customer can send ${row.item} back.`,
                },
              },
              {
                icon: X,
                tone: "danger" as const,
                label: `Reject ${row.id}`,
                confirmCopy:
                  "The customer is told the return was refused, and no money or replacement goes out. Rejecting closes the request.",
                onSelect: () => reject(row.id),
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
              /* Replay-safe: taking the difference is a money movement, so a
                 retried request must not book it twice. */
              onSelect: () => collectPayment(row.id),
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
