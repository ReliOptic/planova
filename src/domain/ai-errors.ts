/**
 * AiError — discriminated union for all AI-layer errors.
 * Kept separate from AppError so the AI feature remains opt-in.
 */
export type AiError =
  | { readonly kind: 'ai/no-key' }
  | { readonly kind: 'ai/offline' }
  | { readonly kind: 'ai/rate-limited'; readonly retryAfterMs: number }
  | { readonly kind: 'ai/http'; readonly status: number; readonly body: string }
  | { readonly kind: 'ai/invalid-response'; readonly reason: string };

// ── type guards ───────────────────────────────────────────────────────────────

/** @returns true if error is an ai/no-key error */
export function isAiNoKey(e: AiError): e is { kind: 'ai/no-key' } {
  return e.kind === 'ai/no-key';
}

/** @returns true if error is an ai/offline error */
export function isAiOffline(e: AiError): e is { kind: 'ai/offline' } {
  return e.kind === 'ai/offline';
}

/** @returns true if error is an ai/rate-limited error */
export function isAiRateLimited(
  e: AiError,
): e is { kind: 'ai/rate-limited'; retryAfterMs: number } {
  return e.kind === 'ai/rate-limited';
}

/** @returns true if error is an ai/http error */
export function isAiHttp(
  e: AiError,
): e is { kind: 'ai/http'; status: number; body: string } {
  return e.kind === 'ai/http';
}

/** @returns true if error is an ai/invalid-response error */
export function isAiInvalidResponse(
  e: AiError,
): e is { kind: 'ai/invalid-response'; reason: string } {
  return e.kind === 'ai/invalid-response';
}
