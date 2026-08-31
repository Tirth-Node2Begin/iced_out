export type ApiMeta = {
  request_id?: string;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
};

export type ApiSuccess<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiFieldError = {
  field?: string;
  detail: string;
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    errors?: ApiFieldError[];
  };
  meta?: Pick<ApiMeta, "request_id">;
};
