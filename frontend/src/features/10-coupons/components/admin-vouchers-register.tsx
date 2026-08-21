"use client";

import { CheckCircle2, Ticket, Wallet } from "lucide-react";
import { useMemo } from "react";

import { useRegister } from "@/api/use-register";
import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Note } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { useCustomers } from "@/features/01-users/customers-store";
import { formatPrice } from "@/features/02-products/utils/format-price";
/* The state, the source and the purpose are computed by the SERVER now
   (`VoucherPresenter::consoleRow`), so the helpers that derived them here are no
   longer read. Only the two date helpers are — the form's defaults. */
import { defaultExpiryISO, formatDay } from "@/features/10-coupons/vouchers";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Every voucher the store has given out, and the one way to give another.
 *
 * Most of these are minted by settling a return. The rest are issued from
 * here — goodwill, a gesture, a promise made over the phone — which is why
 * this screen can create one and a return does not have to exist first. The
 * two kinds sit in one ledger because they are one liability: money the store
 * owes somebody, whatever put it there.
 *
 * Two figures, because they are the only two that are not the same fact twice:
 * what is still owed, and what has already been spent.
 */

const money = (value: string | number) => formatPrice(Number(value) || 0);

const COLUMNS: Column[] = [
  { key: "code", label: "Voucher", primary: true, sub: "issuedLabel" },
  { key: "customer", label: "Customer" },
  /* `purposeNote` is deliberately blank on a voucher whose reason IS its
     source — the register skips an empty sub, so the cell prints one line
     instead of the same line twice. */
  { key: "purpose", label: "What it is for", sub: "purposeNote", primary: true },
  {
    key: "amount",
    label: "Worth",
    align: "right",
    numeric: true,
    render: (row) => money(row.amount),
    exportValue: (row) => money(row.amount),
  },
  {
    key: "expiresOn",
    label: "Redeem by",
    /* Once it is claimed the expiry is history — what an operator wants to know
       is which order took it. */
    render: (row) =>
      row.claimedOn ? (
        <span className="aui-table__primary">
          <strong>{row.claimedOrder || "Redeemed"}</strong>
          <small>{formatDay(row.claimedOn)}</small>
        </span>
      ) : (
        formatDay(row.expiresOn)
      ),
    exportValue: (row) => (row.claimedOn ? `${row.claimedOrder} on ${row.claimedOn}` : row.expiresOn),
  },
  { key: "state", label: "Status", status: true },
];

export function AdminVouchersRegister() {
  /**
   * The voucher ledger, from `/admin/vouchers`.
   *
   * It used to read the same `localStorage` store the shopper's account did, which
   * looked like one ledger and was one BROWSER's ledger: a voucher issued here
   * reached the customer only if the customer was the operator, in the same
   * browser. Settling a return now issues the credit server-side, and this screen
   * reads what was actually issued.
   *
   * `void` rather than delete, and the endpoint says so: a voucher that was issued
   * was issued, and the record of it is what answers "where did my credit go".
   */
  const register = useRegister(
    useMemo(
      () => ({
        path: "/admin/vouchers",
        itemPath: (row: RecordRow) => `/admin/vouchers/${encodeURIComponent(row.code)}`,
        toCreate: (values: RecordRow) => ({
          customer: values.customer,
          amount: Number(values.amount ?? 0) || 0,
          reason: values.reason ?? "",
          expiresOn: values.expiresOn || defaultExpiryISO(),
        }),
        toUpdate: (values: RecordRow) => ({
          amount: Number(values.amount ?? 0) || 0,
          reason: values.reason ?? "",
          expiresOn: values.expiresOn,
        }),
      }),
      [],
    ),
  );

  /* The API returns the console shape already — `VoucherPresenter::consoleRow`
     adds the state, the source and the purpose the table shows — so there is no
     mapping layer here any more. */
  const vouchers = register.rows;
  const balance = vouchers
    .filter((row) => row.state === "Active")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const { customers } = useCustomers();
  /* The two date defaults read the clock, and this page is statically
     exported — so they are only filled once the browser is driving. The form
     is opened by a click, which is always after that. */
  const hydrated = useHydrated();

  const rows = vouchers;

  const FIELDS: FormField[] = [
    {
      key: "customer",
      label: "Give it to",
      type: "select",
      /* The live customer register, not a list typed out here — a name that
         only exists in this file is a voucher assigned to nobody. */
      options: customers.map((customer) => ({
        value: customer.name,
        label: `${customer.name} — ${customer.email}`,
      })),
      required: true,
      full: true,
    },
    {
      key: "amount",
      label: "Amount",
      hint: "₹",
      type: "number",
      /* No min and no step. A step of 100 does not mean "round numbers are
         nicer" — it means the browser REFUSES anything off the ladder, so
         2,550 was rejected as invalid. A voucher is worth whatever the store
         decides it is worth, so nothing here is allowed to argue. */
      min: "",
      placeholder: "2500",
      required: true,
      help: "The whole value comes off one order — a voucher is redeemed once.",
    },
    {
      key: "reason",
      label: "What it is for",
      placeholder: "Goodwill after a late delivery",
      required: true,
      help: "The customer reads this on their vouchers page, so name the reason.",
      full: true,
    },
    {
      key: "expiresOn",
      label: "Expires on",
      type: "date",
      initial: hydrated ? defaultExpiryISO() : "",
      help: "The customer cannot redeem it after this date.",
    },
  ];

  /* Claimed is a fact on the row, not a computation: the presenter fills
     `claimedOn` when an order took the voucher. */
  const claimed = vouchers.filter((row) => Boolean(row.claimedOn));
  const redeemed = claimed.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const stats: Stat[] = [
    {
      label: "Waiting to be redeemed",
      value: formatPrice(balance),
      icon: Wallet,
      tone: balance > 0 ? "amber" : "mint",
      note: `${vouchers.length - claimed.length} voucher${vouchers.length - claimed.length === 1 ? "" : "s"} active`,
    },
    {
      label: "Redeemed",
      value: formatPrice(redeemed),
      icon: CheckCircle2,
      tone: "mint",
      note: `${claimed.length} claimed at checkout`,
    },
  ];

  return (
    <AdminPage
      eyebrow="Vouchers"
      icon={Ticket}
      lede="Store credit the shop has given out. Settling a return creates one automatically, or issue one here and assign it to a customer. Each is good for a single order — once redeemed it is claimed for good."
      title={
        <>
          Voucher <em>ledger</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        columns={COLUMNS}
        emptyHint="No vouchers yet. Issue one here, or settle a return and its credit is recorded for you."
        fields={FIELDS}
        filterKey="state"
        filterValues={["Active", "Claimed"]}
        error={register.error}
        icon={Ticket}
        /* A voucher is addressed by its code, and the SERVER mints it — a code
           minted in a browser could collide with one already issued. */
        idKey="code"
        loaded={register.loaded}
        loading={register.loading}
        onCreate={register.onCreate}
        onDelete={register.onDelete}
        onUpdate={register.onUpdate}
        rows={rows}
        searchKeys={["code", "customer", "reason", "purpose", "purposeNote", "state"]}
        singular="voucher"
        statusTone={(row) => (row.state === "Active" ? "good" : "idle")}
        tone="violet"
        /* Whether it has been claimed is not a question anyone should be asked,
           and it is not on the form — an order claims a voucher, and nothing else
           does. The issue date is the server's too: it is the day the row was
           written, which the browser is not the authority on. */
        derive={(values) => ({
          ...values,
          expiresOn: values.expiresOn || defaultExpiryISO(),
        })}
        /* The amount is never argued with — a voucher is worth whatever the
           store says it is worth, and any figure typed here is written as
           typed. The one rule left is about dates, because a voucher that
           expires before it exists cannot be redeemed by anybody. */
        validate={(values) =>
          values.expiresOn && values.issuedOn && values.expiresOn <= values.issuedOn
            ? "The expiry date has to be after the date it was created."
            : null
        }
      >
        <Note icon={Ticket}>
          A voucher issued here lands on that customer&rsquo;s account straight away, ready to
          redeem at checkout. It is good for <strong>one order</strong> — the whole value comes off
          that order, and the code is claimed for good afterwards.
        </Note>
      </RecordManager>
    </AdminPage>
  );
}

/* `toRow` used to live here, mapping a typed `Voucher` into the flat string map
   this register renders. It is gone: `VoucherPresenter::consoleRow` produces that
   shape on the server, including the three derived columns — the state, where the
   voucher came from and what it was for. One shape, computed once. */
