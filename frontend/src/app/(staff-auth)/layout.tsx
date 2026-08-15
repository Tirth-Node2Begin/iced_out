import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@/styles/components/pages.css";

/**
 * Staff sign in sets its headline in Archivo with the `wdth` axis as a design
 * axis, the same as the customer auth group. The variable has to be loaded on
 * this route group too — without it `var(--font-archivo), …` resolves to
 * nothing, the whole declaration falls out as invalid, and the display type
 * silently inherits Manrope from `body`.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/* Staff sign-in belongs to the console, not the storefront: bare wordmark, no
   page name — same rule as `(admin)/admin/layout.tsx`. */
export const metadata: Metadata = {
  title: { absolute: "Iced Out" },
  robots: { index: false, follow: false },
};

export default function StaffAuthLayout({ children }: { children: ReactNode }) {
  /* `display: contents` keeps the variable in the inheritance chain without
     putting a box between <body> and the page's 100dvh root. */
  return (
    <div className={archivo.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
