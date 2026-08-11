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
    const failure = error.response?.data;
    return new AppError({
      code: failure?.error.code ?? "ICE-NET-500",
      message: failure?.error.message ?? "The request could not be completed.",
      fieldErrors: failure?.error.errors,
      requestId: failure?.meta?.request_id,
      retryable: failure?.error.retryable ?? !error.response,
      status: error.response?.status,
    });
  }

  return new AppError({
    code: "ICE-UI-500",
    message: error instanceof Error ? error.message : "Something unexpected happened.",
  });
}
