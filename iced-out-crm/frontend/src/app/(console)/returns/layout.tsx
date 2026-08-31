import type { ReactNode } from "react";

/**
 * No nav band of its own — the two screens are named in the register's toolbar
 * instead, see `ReturnsTabs`, which is also where the links live.
 *
 * The segment keeps a layout so its `loading.tsx` still has one to suspend in.
 */
export default function ReturnsLayout({ children }: { children: ReactNode }) {
  return children;
}
