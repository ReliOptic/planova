import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { TokenBucketRateLimiter } from '../../../../src/infrastructure/ai/rate-limiter';

describe('TokenBucketRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic acquisition', () => {
    it('allows acquisition when tokens are available', () => {
      const limiter = new TokenBucketRateLimiter({ capacity: 3, refillMs: 60_000 });
      const result = limiter.tryAcquire();
      expect(result.ok).toBe(true);
    });

    it('consumes tokens sequentially', () => {
      const limiter = new TokenBucketRateLimiter({ capacity: 3, refillMs: 60_000 });
      expect(limiter.tryAcquire().ok).toBe(true);
      expect(limiter.tryAcquire().ok).toBe(true);
      expect(limiter.tryAcquire().ok).toBe(true);
    });
  });

  describe('capacity exhaustion', () => {
    it('denies when bucket is empty', () => {
      const limiter = new TokenBucketRateLimiter({ capacity: 2, refillMs: 60_000 });
      limiter.tryAcquire();
      limiter.tryAcquire();
      const result = limiter.tryAcquire();
      expect(result.ok).toBe(false);
    });

    it('returns retryAfterMs > 0 when denied', () => {
      const limiter = new TokenBucketRateLimiter({ capacity: 1, refillMs: 30_000 });
      limiter.tryAcquire(); // consume the only token
      const result = limiter.tryAcquire();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.retryAfterMs).toBeGreaterThan(0);
        expect(result.retryAfterMs).toBeLessThanOrEqual(30_000);
      }
    });

    it('retryAfterMs decreases as time passes', () => {
      vi.useFakeTimers();
      const limiter = new TokenBucketRateLimiter({ capacity: 1, refillMs: 30_000 });
      limiter.tryAcquire(); // exhaust

      const r1 = limiter.tryAcquire();
      expect(r1.ok).toBe(false);
      const wait1 = r1.ok ? 0 : r1.retryAfterMs;

      vi.advanceTimersByTime(10_000);

      const r2 = limiter.tryAcquire();
      expect(r2.ok).toBe(false);
      if (!r2.ok) {
        expect(r2.retryAfterMs).toBeLessThan(wait1);
      }
    });
  });

  describe('refill over time', () => {
    it('allows acquisition again after full refill period', () => {
      vi.useFakeTimers();
      const limiter = new TokenBucketRateLimiter({ capacity: 2, refillMs: 10_000 });
      limiter.tryAcquire();
      limiter.tryAcquire(); // exhaust

      const denied = limiter.tryAcquire();
      expect(denied.ok).toBe(false);

      vi.advanceTimersByTime(10_000);

      const refilled = limiter.tryAcquire();
      expect(refilled.ok).toBe(true);
    });

    it('refills to full capacity (not partial)', () => {
      vi.useFakeTimers();
      const limiter = new TokenBucketRateLimiter({ capacity: 3, refillMs: 10_000 });
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire(); // exhaust all 3

      vi.advanceTimersByTime(10_000);

      // After full refill, should allow 3 acquisitions again
      expect(limiter.tryAcquire().ok).toBe(true);
      expect(limiter.tryAcquire().ok).toBe(true);
      expect(limiter.tryAcquire().ok).toBe(true);
      expect(limiter.tryAcquire().ok).toBe(false);
    });
  });

  describe('retryAfterMs correctness', () => {
    it('retryAfterMs approximates remaining refill window', () => {
      vi.useFakeTimers();
      const REFILL_MS = 60_000;
      const limiter = new TokenBucketRateLimiter({ capacity: 1, refillMs: REFILL_MS });
      limiter.tryAcquire(); // exhaust

      // Immediately after exhaustion, retryAfterMs should be close to REFILL_MS
      const result = limiter.tryAcquire();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.retryAfterMs).toBeGreaterThan(REFILL_MS - 100);
        expect(result.retryAfterMs).toBeLessThanOrEqual(REFILL_MS);
      }
    });
  });
});
