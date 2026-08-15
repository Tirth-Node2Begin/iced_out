/**
 * The returns register.
 *
 * A request arrives `New`, a person approves it or rejects it, and an approved
 * one closes as `Completed` once the money — or the replacement — has gone
 * out. There is no warehouse step in between, so a return is never parked in a
 * state the person reading this screen cannot move it out of.
 *
 * `Awaiting payment` is the one extra, and only exchanges ever reach it: a
 * replacement that costs more than what came back has to be paid for first, and
 * approving such a swap raises that request by itself. It is a state about
 * money that is genuinely still outside the building, not a step anyone chose.
 *
 * `amount` is what the customer paid for the item coming back, so it stays on
 * the record. What the replacement costs does NOT: it is read from the
 * catalogue through `replacementPrice`, because a replacement is priced at
 * what it sells for today, not what something else sold for last month.
 */

export const AWAITING_PAYMENT = "Awaiting payment";

export const RETURN_STATES = ["New", AWAITING_PAYMENT, "Approved", "Completed", "Rejected"];

/**
 * What the customer asked for — and which of the two screens the record lives
 * on. A `Voucher` return is on Returns, an `Exchange` is on Exchanges, and
 * nothing is on both. Neither is a question the operator answers: the tab a
 * record was raised on decides it.
 *
 * Money never goes back to a card from here. A settled return issues a VOUCHER
 * for the value, which the customer spends at checkout, and an exchange settles
 * the same way when the replacement is cheaper — the difference is credit, not
 * a transfer.
 */
export const VOUCHER = "Voucher";
export const EXCHANGE = "Exchange";

export const RETURN_REASONS = [
  "Size / fit",
  "Changed mind",
  "Quality concern",
  "Wrong item",
  "Damaged in transit",
];

/** Held by a return that is not an exchange, and by one still being chosen. */
export const NO_REPLACEMENT = "";

export const adminReturnFixtures = [
  { id: "ret-072", order: "IO-2026-1027", customer: "Aarav Mehta", item: "Bone Utility Overshirt · L", reason: "Size / fit", outcome: "Exchange", amount: "11400", replacement: "Shadow Cargo 02 · L", state: "New" },
  { id: "ret-071", order: "IO-2026-1024", customer: "Ishita Rao", item: "Shadow Cargo 02 · M", reason: "Changed mind", outcome: "Voucher", amount: "9800", replacement: NO_REPLACEMENT, state: "New" },
  { id: "ret-069", order: "IO-2026-1018", customer: "Kabir Shah", item: "Afterdark Hoodie · M", reason: "Quality concern", outcome: "Exchange", amount: "8900", replacement: "Bone Utility Overshirt · L", state: "Approved" },
  { id: "ret-066", order: "IO-2026-1011", customer: "Meera Nair", item: "Core Heavy Tee · S", reason: "Wrong item", outcome: "Voucher", amount: "4600", replacement: NO_REPLACEMENT, state: "Approved" },
  { id: "ret-064", order: "IO-2026-1008", customer: "Ananya Bose", item: "Core Heavy Tee · S", reason: "Size / fit", outcome: "Exchange", amount: "4600", replacement: "Core Heavy Tee · M", state: "Completed" },
  { id: "ret-058", order: "IO-2026-0996", customer: "Diya Kapoor", item: "Afterdark Hoodie · XL", reason: "Changed mind", outcome: "Voucher", amount: "8900", replacement: NO_REPLACEMENT, state: "Rejected" },
];
