import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@/styles/components/pages.css";

/**
 * Archivo is the site's family (new_style §3.1) and the auth pages set their
 * headline in it, but this route group never loaded it — `--font-archivo`
 * resolved to nothing, so every `var(--font-archivo), …` declaration fell out
 * as invalid and the display type inherited Manrope from `body`. The `wdth`
 * axis is required: the headline's second cut and the media wordmark are set
 * at 112% / 118%.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export default function CustomerAuthLayout({ children }: { children: ReactNode }) {
  /* `display: contents` keeps the variable in the inheritance chain without
     putting a box between <body> and the page's 100dvh root. */
  return (
    <div className={archivo.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
