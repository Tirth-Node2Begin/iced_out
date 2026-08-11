import type { Metadata } from "next";
import type { ReactNode } from "react";

/* The page's own sheet. Everything in it is scoped under `.ct-root`, including
   the block that re-points the shadcn tokens at the nh palette — so it has to
   load on this route and nowhere else. */
import "@/styles/contact.css";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach a human at Iced_out. Sizing, shipping, returns and order questions — answered within two business days.",
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
