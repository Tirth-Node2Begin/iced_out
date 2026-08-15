import type { Metadata } from "next";
import type { ReactNode } from "react";

/* Title carrier only — the panel itself is a client component, which cannot
   export `metadata`. */
export const metadata: Metadata = { title: "Profile" };

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
