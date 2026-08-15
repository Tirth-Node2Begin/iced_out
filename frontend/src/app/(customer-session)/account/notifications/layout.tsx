import type { Metadata } from "next";
import type { ReactNode } from "react";

/* Title carrier only — the panel itself is a client component, which cannot
   export `metadata`. */
export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return children;
}
