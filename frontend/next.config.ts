import type { NextConfig } from "next";

/**
 * Where the PHP API is listening, for the dev proxy below.
 *
 * 127.0.0.1 rather than localhost on purpose: this hop is made by the Next dev
 * server, and on Windows `localhost` resolves to ::1 first while PHP's built-in
 * server is IPv4-only, so every request would wait for that to fail.
 */
const API_ORIGIN = process.env.API_PROXY_ORIGIN ?? "http://127.0.0.1:8000";

/** `next dev` sets this; `next build` does not. */
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  /**
   * A static export cannot have rewrites, so the export target is only set for
   * a real build. Development keeps a server, which is what makes the proxy
   * below possible.
   */
  ...(isDev ? {} : { output: "export" as const }),

  /**
   * The API, served from the SAME ORIGIN as the site during development.
   *
   * The site runs on localhost:3000 and the API on 127.0.0.1:8000. Those are
   * different *sites* to a browser, so a SameSite=Lax session cookie is never
   * sent across that line — the shopper would look signed out on every request
   * no matter how correct both halves are. Proxying through Next makes the
   * call first-party: no CORS preflight, no cross-site cookie, and the hop to
   * PHP is server-to-server.
   *
   * It also matches production, where Nginx serves the export at `/` and
   * proxies `/api/v1` to PHP-FPM (spec §3.1). One address in both places.
   */
  async rewrites() {
    if (!isDev) return [];

    return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
  },

  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    /**
     * Barrel packages, rewritten to deep imports at compile time.
     *
     * Measured, and worth being honest about: on the tree as it stands this
     * changes nothing. A clean rebuild with these entries produced shared
     * chunks that were byte-identical to the build without them — same content
     * hashes, same 1447 KB. `radix-ui` (imported by all twenty files in
     * `components/ui/`) and `motion` (imported by 43 components) already ship
     * ESM that webpack tree-shakes properly, so there was nothing left for the
     * transform to remove.
     *
     * Kept anyway, because it is a compile-time SWC transform with no runtime
     * cost and it is cheap insurance: the day someone adds a dependency whose
     * barrel is *not* shakeable, this catches it silently instead of quietly
     * adding a few hundred KB to every page. Do not expect it to show up in a
     * bundle diff today.
     */
    optimizePackageImports: [
      "radix-ui",
      "motion",
      "motion/react",
      "lucide-react",
      "cmdk",
      "sonner",
    ],
  },
};

export default nextConfig;
