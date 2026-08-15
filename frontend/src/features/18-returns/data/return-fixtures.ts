/**
 * The customer's own view of their returns.
 *
 * These are the same records the console holds in `admin-return-fixtures`,
 * seen from the other side — `ret-072` is one return, and both files describe
 * it the same way. What the customer is not shown is the internal state name;
 * they get `status`, which is the same journey said in their words.
 *
 * `amount` is a number, not a formatted string, because the exchange
 * arithmetic in `utils/exchange` has to be able to do sums with it — and the
 * customer must be quoted the figure the console approves.
 */

export type ReturnFixture = {
  id: string;
  order: string;
  item: string;
  variant: string;
  outcome: "Voucher" | "Exchange";
  /** What the customer paid for the item going back. */
  amount: number;
  /** The item going out instead. Empty on anything but an exchange. */
  replacement: string;
  /** Where the value lands — a voucher code, once one has been issued. */
  destination: string;
  status: "Pickup scheduled" | "Voucher issued" | "Exchange on its way";
  reference: string;
};

export const returnFixtures: ReturnFixture[] = [
  {
    id: "ret-072",
    order: "IO-2026-1027",
    item: "Bone Utility Overshirt",
    variant: "Bone / L",
    outcome: "Exchange",
    amount: 11400,
    replacement: "Shadow Cargo 02 · L",
    destination: "Store credit balance",
    status: "Pickup scheduled",
    reference: "ref_••••072",
  },
  {
    id: "ret-061",
    order: "IO-2026-0994",
    item: "Core Heavy Tee",
    variant: "Ink / S",
    outcome: "Voucher",
    amount: 4600,
    replacement: "",
    /* The voucher this return issued — `IOV061` in the vouchers store, which is
       the one a new browser starts holding. Both screens name the same code. */
    destination: "Voucher IOV061",
    status: "Voucher issued",
    reference: "IOV061",
  },
];
