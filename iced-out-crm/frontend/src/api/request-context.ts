export function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `web-${Date.now().toString(36)}`;
}

export function createIdempotencyKey(scope: string) {
  return `${scope}-${createRequestId()}`;
}

export function getRequestContext() {
  return {
    "X-Request-Id": createRequestId(),
    "X-Client-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Accept-Language": navigator.language,
  };
}
