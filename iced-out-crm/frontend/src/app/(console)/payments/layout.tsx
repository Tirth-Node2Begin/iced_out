import type { ReactNode } from "react";

/**
 * No nav band of its own. The area's three screens are named inside each
 * register's toolbar instead — see `PaymentTabs` — so payments reads as one row
 * of controls rather than a strip of tabs above a strip of filters.
 *
 * The segment keeps a layout so its `loading.tsx` still has one to suspend in.
 */
export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return children;
}
