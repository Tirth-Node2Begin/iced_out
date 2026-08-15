import type { Metadata } from "next";
import type { ReactNode } from "react";

import { sectionTitle } from "@/lib/tab-title";

/* Title carrier only — the panel itself is a client component, which cannot
   export `metadata`. `sectionTitle` because `[orderId]` titles itself. */
export const metadata: Metadata = { title: sectionTitle("Orders") };

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return children;
}
