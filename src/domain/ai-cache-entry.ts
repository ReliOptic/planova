/**
 * AiCacheEntry — a cached AI response stored in IndexedDB.
 * Keyed by sha256(model + '::' + normalizedPrompt).
 */
export interface AiCacheEntry {
  /** sha256(model + '::' + normalizedPrompt) */
  readonly key: string;
  /** Raw text content from the AI response. */
  readonly response: string;
  /** Unix timestamp (ms) when this entry was stored. */
  readonly createdAt: number;
  /** Time-to-live in milliseconds. Entry is stale when now > createdAt + ttlMs. */
  readonly ttlMs: number;
}
