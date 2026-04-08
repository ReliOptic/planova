import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { PlanovaDatabase } from '../../../../src/infrastructure/persistence/db';
import { DexieAiCredentialRepository } from '../../../../src/infrastructure/persistence/ai-credential-repository';
import { DexieResponseCache } from '../../../../src/infrastructure/ai/response-cache';
import { TokenBucketRateLimiter } from '../../../../src/infrastructure/ai/rate-limiter';
import { OpenRouterClient } from '../../../../src/infrastructure/ai/openrouter-client';
import { createAiCredential } from '../../../../src/domain/ai-credential';

function makeValidResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

let db: PlanovaDatabase;
let credRepo: DexieAiCredentialRepository;
let responseCache: DexieResponseCache;
let limiter: TokenBucketRateLimiter;
let client: OpenRouterClient;

beforeEach(async () => {
  db = new PlanovaDatabase('test-or-client-' + Math.random());
  await db.open();
  credRepo = new DexieAiCredentialRepository(db);
  responseCache = new DexieResponseCache(db);
  limiter = new TokenBucketRateLimiter({ capacity: 10, refillMs: 600_000 });
  client = new OpenRouterClient(credRepo, responseCache, limiter);
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenRouterClient.complete', () => {
  describe('offline short-circuit', () => {
    it('returns ai/offline when navigator.onLine is false', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const result = await client.complete({ prompt: 'hello' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('ai/offline');
    });
  });

  describe('no-key short-circuit', () => {
    it('returns ai/no-key when no credential is stored', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const result = await client.complete({ prompt: 'hello' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('ai/no-key');
    });
  });

  describe('cache hit', () => {
    it('returns cached response without calling fetch', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const credResult = createAiCredential({ apiKey: 'sk-or-test', model: 'test-model' });
      expect(credResult.ok).toBe(true);
      if (credResult.ok) await credRepo.save(credResult.value);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // Pre-populate cache
      const { buildCacheKey } = await import('../../../../src/infrastructure/ai/response-cache');
      const key = await buildCacheKey('test-model', 'cached prompt');
      await responseCache.set(key, 'cached response');

      const result = await client.complete({ prompt: 'cached prompt' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('cached response');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('rate limit denial', () => {
    it('returns ai/rate-limited when bucket is exhausted', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const credResult = createAiCredential({ apiKey: 'sk-or-test', model: 'test-model' });
      if (credResult.ok) await credRepo.save(credResult.value);

      const exhaustedLimiter = new TokenBucketRateLimiter({ capacity: 0, refillMs: 600_000 });
      // Capacity 0 means tryAcquire always denies — simulate by exhausting normally
      const tinyLimiter = new TokenBucketRateLimiter({ capacity: 1, refillMs: 600_000 });
      tinyLimiter.tryAcquire(); // exhaust

      const rateLimitedClient = new OpenRouterClient(credRepo, responseCache, tinyLimiter);

      const result = await rateLimitedClient.complete({ prompt: 'any prompt' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('ai/rate-limited');
        if (result.error.kind === 'ai/rate-limited') {
          expect(result.error.retryAfterMs).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('happy path', () => {
    it('returns ok with content from a valid fetch response', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const credResult = createAiCredential({ apiKey: 'sk-or-test', model: 'test-model' });
      if (credResult.ok) await credRepo.save(credResult.value);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeValidResponse('AI says hello'),
      );

      const result = await client.complete({ prompt: 'hello world' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('AI says hello');
    });

    it('caches the response after a successful fetch', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const credResult = createAiCredential({ apiKey: 'sk-or-test', model: 'test-model' });
      if (credResult.ok) await credRepo.save(credResult.value);

      // Set up mock before both calls so we can count invocations accurately
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeValidResponse('cached after fetch'),
      );

      // First call — triggers real fetch
      await client.complete({ prompt: 'store this' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call — should be served from cache, no additional fetch
      const result = await client.complete({ prompt: 'store this' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('cached after fetch');
      expect(fetchSpy).toHaveBeenCalledTimes(1); // still only 1
    });
  });

  describe('HTTP error', () => {
    it('returns ai/http on non-ok response', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const credResult = createAiCredential({ apiKey: 'sk-or-test', model: 'test-model' });
      if (credResult.ok) await credRepo.save(credResult.value);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 }),
      );

      const result = await client.complete({ prompt: 'bad key' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('ai/http');
        if (result.error.kind === 'ai/http') {
          expect(result.error.status).toBe(401);
        }
      }
    });
  });

  describe('invalid response shape', () => {
    it('returns ai/invalid-response when choices is missing', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const credResult = createAiCredential({ apiKey: 'sk-or-test', model: 'test-model' });
      if (credResult.ok) await credRepo.save(credResult.value);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await client.complete({ prompt: 'bad shape' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('ai/invalid-response');
    });
  });
});
