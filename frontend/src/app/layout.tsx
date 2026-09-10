import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@fontsource-variable/manrope";
import "@fontsource-variable/syne";
import "@fontsource/roboto-mono/latin-400.css";
import "@/styles/index.css";

import { AppProviders } from "@/providers/app-providers";
import { SITE_NAME, TAB_TEMPLATE } from "@/lib/tab-title";

/**
 * The site's family (new_style §3.1), declared on `<body>` so `--font-archivo`
 * resolves for the whole document.
 *
 * Each route group also loads its own instance — that is fine, they dedupe to
 * the same files — but a group's variable only reaches the elements inside it.
 * The header's search dock and menu sheet portal to `document.body` to escape
 * the sticky bar's stacking context, which puts them outside every one of those
 * scopes; without this they rendered in the fallback face.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const PERFORMANCE_MODE_BOOTSTRAP = `
(function () {
  try {
    var nav = navigator || {};
    var connection = nav.connection || {};
    var memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
    var cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined;
    var saveData = !!connection.saveData;
    var slowConnection = /(^slow-2g$|^2g$)/.test(connection.effectiveType || "");
    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var viewportWidth = Math.min(window.innerWidth || Infinity, (window.screen && window.screen.width) || Infinity);
    var viewportHeight = Math.min(window.innerHeight || Infinity, (window.screen && window.screen.height) || Infinity);
    var smallScreen = viewportWidth <= 700 || viewportHeight <= 560;
    var phone = coarse && viewportWidth <= 780;
    var lowMemory = memory !== undefined && memory <= 3;
    var constrainedMemory = memory !== undefined && memory <= 4;
    var weakCpu = cores !== undefined && cores <= 4;
    var modestCpu = cores !== undefined && cores <= 6;
    var modestMemory = memory !== undefined && memory <= 6;
    var low = reducedMotion || saveData || slowConnection || lowMemory || (phone && (constrainedMemory || weakCpu || viewportWidth <= 430)) || (smallScreen && constrainedMemory && weakCpu);
    var medium = !low && (phone || viewportWidth <= 1024 || modestCpu || modestMemory || smallScreen);
    var root = document.documentElement;
    root.dataset.performanceMode = low ? "low" : medium ? "medium" : "high";
    root.dataset.motion = reducedMotion ? "reduced" : "full";
    root.dataset.saveData = saveData ? "true" : "false";
  } catch (_) {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://iced-out.example"),
  /** `Iced Out • <page>` — see `@/lib/tab-title` for the rule and its exception. */
  title: {
    default: SITE_NAME,
    template: TAB_TEMPLATE,
  },
  description:
    "Limited-run heavyweight streetwear engineered for after dark. Discover Drop 001 by Iced_out.",
  applicationName: "Iced_out",
  keywords: ["streetwear", "clothing", "limited drop", "Indian fashion", "Iced_out"],
  openGraph: {
    title: "Iced_out — Cold by nature",
    description: "Heavyweight streetwear. Limited by design.",
    type: "website",
    images: [
      {
        url: "/images/iced-out-og.jpg",
        width: 1200,
        height: 630,
        alt: "Iced_out Drop 001 campaign",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      data-performance-mode="high"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PERFORMANCE_MODE_BOOTSTRAP }} />
      </head>
      <body className={archivo.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
