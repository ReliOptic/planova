import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { PlanovaDatabase } from '../../../../src/infrastructure/persistence/db';
import { DexieResponseCache, buildCacheKey, sha256Hex } from '../../../../src/infrastructure/ai/response-cache';

let db: PlanovaDatabase;
let cache: DexieResponseCache;

beforeEach(async () => {
  db = new PlanovaDatabase('test-ai-cache-' + Math.random());
  await db.open();
  cache = new DexieResponseCache(db);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sha256Hex', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const result = await sha256Hex('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', async () => {
    const a = await sha256Hex('test-input');
    const b = await sha256Hex('test-input');
    expect(a).toBe(b);
  });

  it('differs for different inputs', async () => {
    const a = await sha256Hex('foo');
    const b = await sha256Hex('bar');
    expect(a).not.toBe(b);
  });
});

describe('buildCacheKey', () => {
  it('normalises whitespace and case', async () => {
    const k1 = await buildCacheKey('model', '  Hello World  ');
    const k2 = await buildCacheKey('model', 'hello world');
    expect(k1).toBe(k2);
  });

  it('differs for different models', async () => {
    const k1 = await buildCacheKey('model-a', 'prompt');
    const k2 = await buildCacheKey('model-b', 'prompt');
    expect(k1).not.toBe(k2);
  });

  it('collapses inner whitespace', async () => {
    const k1 = await buildCacheKey('m', 'hello   world');
    const k2 = await buildCacheKey('m', 'hello world');
    expect(k1).toBe(k2);
  });
});

describe('DexieResponseCache', () => {
  describe('get / set', () => {
    it('returns null for unknown key', async () => {
      const result = await cache.get('nonexistent-key');
      expect(result).toBeNull();
    });

    it('stores and retrieves a response', async () => {
      await cache.set('key-1', 'response text');
      const result = await cache.get('key-1');
      expect(result).toBe('response text');
    });

    it('overwrites an existing entry on set', async () => {
      await cache.set('key-1', 'first');
      await cache.set('key-1', 'second');
      expect(await cache.get('key-1')).toBe('second');
    });
  });

  describe('TTL expiry', () => {
    it('returns null and deletes entry after TTL expires', async () => {
      // Manually insert an already-expired entry (createdAt in the past)
      const now = Date.now();
      await db.aiCache.put({
        key: 'ttl-key',
        response: 'will expire',
        createdAt: now - 2_000, // 2s ago
        ttlMs: 1_000,            // TTL was 1s → already expired
      });

      const result = await cache.get('ttl-key');
      expect(result).toBeNull();

      // Row should have been deleted
      const row = await db.aiCache.get('ttl-key');
      expect(row).toBeUndefined();
    });

    it('does not expire before TTL elapses', async () => {
      const now = Date.now();
      // Insert an entry that expires 5s from now
      await db.aiCache.put({
        key: 'live-key',
        response: 'still alive',
        createdAt: now - 1_000, // 1s ago
        ttlMs: 5_000,            // TTL is 5s → still valid
      });

      expect(await cache.get('live-key')).toBe('still alive');
    });
  });

  describe('key collision', () => {
    it('different keys do not interfere', async () => {
      await cache.set('key-a', 'alpha');
      await cache.set('key-b', 'beta');
      expect(await cache.get('key-a')).toBe('alpha');
      expect(await cache.get('key-b')).toBe('beta');
    });
  });
});
