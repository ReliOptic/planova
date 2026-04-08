import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, type Result } from '../../../src/domain/result';

describe('ok()', () => {
  it('sets ok: true and exposes value', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('works with string values', () => {
    const result = ok('hello');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('hello');
    }
  });

  it('works with object values', () => {
    const result = ok({ id: '1', name: 'test' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: '1', name: 'test' });
    }
  });
});

describe('err()', () => {
  it('sets ok: false and exposes error', () => {
    const result = err({ kind: 'repo/not-found', id: 'abc' } as const);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ kind: 'repo/not-found', id: 'abc' });
    }
  });

  it('works with string errors', () => {
    const result = err('something went wrong');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('something went wrong');
    }
  });
});

describe('isOk()', () => {
  it('returns true for ok results', () => {
    const result: Result<number, string> = ok(1);
    expect(isOk(result)).toBe(true);
  });

  it('returns false for err results', () => {
    const result: Result<number, string> = err('fail');
    expect(isOk(result)).toBe(false);
  });
});

describe('isErr()', () => {
  it('returns true for err results', () => {
    const result: Result<number, string> = err('fail');
    expect(isErr(result)).toBe(true);
  });

  it('returns false for ok results', () => {
    const result: Result<number, string> = ok(1);
    expect(isErr(result)).toBe(false);
  });
});
