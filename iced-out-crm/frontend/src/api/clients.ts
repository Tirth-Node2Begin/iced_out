import axios, { type AxiosInstance } from "axios";

import { normalizeApiError } from "@/api/error-normalizer";
import { getRequestContext } from "@/api/request-context";

type ApiAudience = "public" | "customer" | "admin";

/**
 * The API's address — relative, and that is the whole point.
 *
 * `/api/v1` is same-origin wherever the site is served from, so the session
 * cookie is first-party and no CORS preflight ever happens. Both halves of the
 * project already arrange for that path to reach PHP:
 *
 *   development — `next dev` proxies /api/v1 to the API (see next.config.ts),
 *                 which is what lets the site run on localhost:3000 while the
 *                 API listens on 127.0.0.1:8000. Calling the API's own origin
 *                 directly would be cross-site, and a SameSite=Lax cookie is
 *                 not sent across that line.
 *   production  — Nginx serves the static export at / and proxies /api/v1 to
 *                 PHP-FPM (spec §3.1).
 *
 * `NEXT_PUBLIC_API_BASE_URL` overrides it for a deployment where the API is
 * genuinely on another origin. Set it only if you have also arranged for the
 * cookie to survive that trip.
 */
export function apiBaseUrl(): string {
  // `||`, not `??`. Next inlines NEXT_PUBLIC_* at build time, and a variable
  // written as `NEXT_PUBLIC_API_BASE_URL=` in an env file is inlined as the
  // EMPTY STRING, not as undefined — which `??` happily keeps. The result is
  // `baseURL: ""`, so every call goes to /admin/… instead of /api/v1/admin/…,
  // the static shell answers them, and every console screen is empty with no
  // error anywhere that says why. An empty value means "not set" here.
  return process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
}

function createClient(audience: ApiAudience): AxiosInstance {
  const client = axios.create({
    baseURL: apiBaseUrl(),
    timeout: 12_000,
    withCredentials: audience !== "public",
  });

  client.interceptors.request.use((config) => {
    config.headers.set("X-Client-Audience", audience);
    Object.entries(getRequestContext()).forEach(([key, value]) => {
      config.headers.set(key, value);
    });
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(normalizeApiError(error)),
  );

  return client;
}

export const publicClient = createClient("public");
export const customerClient = createClient("customer");
export const adminClient = createClient("admin");
