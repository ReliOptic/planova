import type { AiCacheEntry } from '../../domain/ai-cache-entry';
import type { PlanovaDatabase } from '../persistence/db';

/** Default TTL for cached AI responses (24 hours in ms). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Computes a SHA-256 hex digest of the input string using the Web Crypto API.
 *
 * @param input — arbitrary UTF-8 string
 * @returns lowercase hex string of length 64
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Builds a deterministic cache key from a model ID and prompt.
 * Normalisation: strip leading/trailing whitespace, collapse inner whitespace, lowercase.
 *
 * @param model  — OpenRouter model ID
 * @param prompt — user prompt text
 */
export async function buildCacheKey(model: string, prompt: string): Promise<string> {
  const normalizedPrompt = prompt.trim().replace(/\s+/g, ' ').toLowerCase();
  return sha256Hex(`${model}::${normalizedPrompt}`);
}

/**
 * DexieResponseCache — persists AI responses in IndexedDB with TTL semantics.
 */
export class DexieResponseCache {
  constructor(private readonly _db: PlanovaDatabase) {}

  /**
   * Look up a cached response by key.
   * Returns null and deletes the row if the entry has expired.
   *
   * @param key — cache key produced by buildCacheKey
   */
  async get(key: string): Promise<string | null> {
    const entry = await this._db.aiCache.get(key);
    if (entry === undefined) return null;

    const isExpired = Date.now() > entry.createdAt + entry.ttlMs;
    if (isExpired) {
      await this._db.aiCache.delete(key).catch(() => {
        // best-effort delete; ignore failure
      });
      return null;
    }

    return entry.response;
  }

  /**
   * Store a response under the given key with an optional TTL.
   *
   * @param key      — cache key produced by buildCacheKey
   * @param response — raw text from the AI
   * @param ttlMs    — time-to-live in ms (default 24 h)
   */
  async set(key: string, response: string, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const entry: AiCacheEntry = {
      key,
      response,
      createdAt: Date.now(),
      ttlMs,
    };
    await this._db.aiCache.put(entry);
  }
}
