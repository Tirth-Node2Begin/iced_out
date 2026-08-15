import type { Metadata } from "next";
import type { ReactNode } from "react";

/* Title carrier only — the panel itself is a client component, which cannot
   export `metadata`. */
export const metadata: Metadata = { title: "Addresses" };

export default function AddressesLayout({ children }: { children: ReactNode }) {
  return children;
}
