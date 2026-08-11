import axios, { type AxiosInstance } from "axios";

import { normalizeApiError } from "@/api/error-normalizer";
import { getRequestContext } from "@/api/request-context";

type ApiAudience = "public" | "customer" | "admin";

function createClient(audience: ApiAudience): AxiosInstance {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
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
