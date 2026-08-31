import type { ReactNode } from "react";

/**
 * No nav band. Support is one screen, so its "tabs" were a single pill that
 * navigated to the page it was already on — a strip of chrome that named the
 * area and did nothing else, above a page head whose eyebrow already says
 * "Support".
 *
 * The segment keeps a layout so its `loading.tsx` still has one to suspend in.
 */
export default function SupportLayout({ children }: { children: ReactNode }) {
  return children;
}
