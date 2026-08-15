import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AccountShell } from "@/components/account/account-shell";
import { sectionTitle } from "@/lib/tab-title";

/* The account root's own tab, and the fallback for any panel that does not name
   itself. `sectionTitle` rather than a plain string because the panels below do
   name themselves — see the note there. Panels that are client components carry
   their title in a sibling `layout.tsx`, since `metadata` cannot be exported
   from `"use client"`. */
export const metadata: Metadata = { title: sectionTitle("Account") };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
