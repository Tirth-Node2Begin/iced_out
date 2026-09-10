import axios from "axios";

import type { ApiFailure, ApiFieldError } from "@/api/types";

export class AppError extends Error {
  code: string;
  fieldErrors: ApiFieldError[];
  requestId?: string;
  retryable: boolean;
  status?: number;

  constructor(options: {
    code: string;
    message: string;
    fieldErrors?: ApiFieldError[];
    requestId?: string;
    retryable?: boolean;
    status?: number;
  }) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? [];
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

export function normalizeApiError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (axios.isAxiosError<ApiFailure>(error)) {
    /* THE BODY IS NOT ALWAYS OUR ENVELOPE.
       This used to read `failure?.error.code` — the optional chain guards
       `failure`, not `failure.error`. Any response that is not the API's own
       JSON shape therefore threw a TypeError *inside the rejection handler*, so
       the caller received a TypeError instead of an AppError.

       That is not hypothetical on cPanel/Apache: a 502, 503, 504, a mod_security
       406 or a 413 all return HTML. The consequences were quiet and specific —
       `needsStepUp()` tests `instanceof AppError` and became false, so a 428
       reshaped by a proxy stopped raising the password prompt; `isUnauthenticated()`
       tests for a `status` field a TypeError has none of, so a 401 read as a
       network blip; and checkout rendered the raw JS message to the shopper as
       the reason their order failed.

       So the envelope is proved before it is read, and the transport status is
       kept either way — it is the one thing that is always true. */
    const body = error.response?.data as unknown;
    const detail =
      body !== null && typeof body === "object" && "error" in body
        ? (body as ApiFailure).error
        : undefined;

    return new AppError({
      code: detail?.code ?? "ICE-NET-500",
      message: detail?.message ?? "The request could not be completed.",
      fieldErrors: detail?.errors,
      requestId:
        body !== null && typeof body === "object" && "meta" in body
          ? (body as ApiFailure).meta?.request_id
          : undefined,
      retryable: detail?.retryable ?? !error.response,
      status: error.response?.status,
    });
  }

  return new AppError({
    code: "ICE-UI-500",
    message: error instanceof Error ? error.message : "Something unexpected happened.",
  });
}
