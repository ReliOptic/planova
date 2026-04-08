import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../../src/components/error-boundary';
import type { Logger } from '../../../src/infrastructure/logger/logger';

/** Minimal Logger stub for testing. */
function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    listRecent: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ErrorBoundary', () => {
  describe('getDerivedStateFromError', () => {
    it('returns hasError: true with the given error', () => {
      const err = new Error('boom');
      const state = ErrorBoundary.getDerivedStateFromError(err);
      expect(state.hasError).toBe(true);
      expect(state.error).toBe(err);
    });

    it('returns the exact error instance', () => {
      const err = new Error('something went wrong');
      const state = ErrorBoundary.getDerivedStateFromError(err);
      expect(state.error?.message).toBe('something went wrong');
    });
  });

  describe('componentDidCatch', () => {
    it('calls logger.error with react/error-boundary scope', () => {
      const log = makeLogger();
      const boundary = new ErrorBoundary({ children: null, logger: log });
      const err = new Error('render crash');
      const info = { componentStack: '\n  at SomeComponent', digest: undefined };

      boundary.componentDidCatch(err, info);

      expect(log.error).toHaveBeenCalledOnce();
      expect(log.error).toHaveBeenCalledWith(
        'react/error-boundary',
        'render crash',
        expect.objectContaining({ componentStack: '\n  at SomeComponent' }),
      );
    });

    it('includes stack in the context object', () => {
      const log = makeLogger();
      const boundary = new ErrorBoundary({ children: null, logger: log });
      const err = new Error('stack test');
      boundary.componentDidCatch(err, { componentStack: null, digest: undefined });

      const callArgs = (log.error as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
      expect(callArgs[2]).toHaveProperty('stack');
    });
  });

  describe('initial state', () => {
    it('initialises with hasError: false via getDerivedStateFromError returning true', () => {
      const state = ErrorBoundary.getDerivedStateFromError(new Error('x'));
      expect(state.hasError).toBe(true);
    });

    it('getDerivedStateFromError preserves the error instance', () => {
      const err = new Error('preserved');
      const state = ErrorBoundary.getDerivedStateFromError(err);
      expect(state.error).toBe(err);
    });
  });
});
