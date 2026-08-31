"use client";

import { AdminModuleNav } from "@/components/shell/admin-module-nav";

/**
 * The payments area's screens — money in, and money on to the bank.
 *
 * Refunds used to be the middle one. It moved to the Returns module, because
 * money going back to a customer is the last step of a return rather than a
 * kind of payment in its own right: the request, the swap, the refund and the
 * voucher are one story, and reading it meant crossing modules halfway
 * through. Payments is now what came IN and what went on OUT to the bank.
 */
export const PAYMENT_LINKS = [
  { href: "/payments", label: "Payments" },
  { href: "/payments/payouts", label: "Payouts" },
];

export function PaymentTabs() {
  return <AdminModuleNav inline label="Payments" links={PAYMENT_LINKS} />;
}
