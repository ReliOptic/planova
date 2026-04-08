/** Options for constructing a TokenBucketRateLimiter. */
export interface TokenBucketOptions {
  /** Maximum number of tokens the bucket can hold. */
  readonly capacity: number;
  /** Time in ms after which the bucket fully refills. */
  readonly refillMs: number;
}

/** Result of a tryAcquire call. */
export type AcquireResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterMs: number };

/**
 * TokenBucketRateLimiter — in-memory token bucket.
 *
 * State resets on page reload (acceptable for a client-side rate limit).
 * Default configuration: capacity 10, refill every 600_000 ms (10 per 10 min).
 */
export class TokenBucketRateLimiter {
  private _tokens: number;
  private _lastRefillAt: number;

  constructor(private readonly _opts: TokenBucketOptions) {
    this._tokens = _opts.capacity;
    this._lastRefillAt = Date.now();
  }

  /**
   * Attempt to consume one token.
   *
   * @returns `{ ok: true }` when a token was consumed,
   *          `{ ok: false, retryAfterMs }` when the bucket is empty.
   */
  tryAcquire(): AcquireResult {
    this._refill();

    if (this._tokens >= 1) {
      this._tokens -= 1;
      return { ok: true };
    }

    const elapsed = Date.now() - this._lastRefillAt;
    const retryAfterMs = Math.max(0, this._opts.refillMs - elapsed);
    return { ok: false, retryAfterMs };
  }

  private _refill(): void {
    const now = Date.now();
    const elapsed = now - this._lastRefillAt;
    if (elapsed >= this._opts.refillMs) {
      this._tokens = this._opts.capacity;
      this._lastRefillAt = now;
    }
  }
}
