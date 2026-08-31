import type { NextConfig } from "next";

/**
 * Where the CRM's PHP API is listening.
 *
 * 8100, not 8000 — that is the storefront's. The two backends are separate
 * processes against one database, and the CRM only ever talks to its own.
 *
 * 127.0.0.1 rather than localhost on purpose: this hop is made by the Next dev
 * server, and on Windows `localhost` resolves to ::1 first while PHP's built-in
 * server is IPv4-only, so every request would wait for that to fail.
 */
const API_ORIGIN = process.env.API_PROXY_ORIGIN ?? "http://127.0.0.1:8100";

/** `next dev` sets this; `next build` does not. */
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  /**
   * A static export cannot have rewrites, so the export target is only set for
   * a real build. Development keeps a server, which is what makes the proxy
   * below possible.
   *
   * The CRM is a static CSR shell like the storefront: every screen fetches in
   * the browser and no page is server-rendered. That is deliberate here for the
   * same reason it is there — and it is also why nothing under `app/` reads a
   * cookie or a session on the server.
   */
  ...(isDev ? {} : { output: "export" as const }),

  /**
   * The API, served from the SAME ORIGIN as the CRM during development.
   *
   * The CRM runs on localhost:3100 and its API on 127.0.0.1:8100. Those are
   * different *sites* to a browser, so the SameSite=Lax staff cookie would
   * never be sent across that line — an operator would look signed out on every
   * request no matter how correct both halves are. Proxying through Next makes
   * the call first-party: no CORS preflight, no cross-site cookie, and the hop
   * to PHP is server-to-server.
   *
   * It also matches production, where Nginx serves the export at `/` on the CRM
   * host and proxies `/api/v1` to that host's PHP-FPM. One address in both.
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
    optimizePackageImports: ["radix-ui", "motion", "motion/react", "lucide-react", "cmdk", "sonner"],
  },
};

export default nextConfig;
