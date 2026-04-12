import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichWithLlm } from '../../../../src/services/recommendation/llm-recommender';
import type { DetectedPattern } from '../../../../src/services/recommendation/types';
import { ok, err } from '../../../../src/domain/result';
import type { AiError } from '../../../../src/domain/ai-errors';

function makePattern(id = 'wt-test'): DetectedPattern {
  const day = Array.from<number>({ length: 7 }).fill(0);
  day[1] = 4;
  const hour = Array.from<number>({ length: 24 }).fill(0);
  hour[8] = 4;
  return {
    id,
    kind: 'weekday-time',
    label: '매주 월요일 08:00',
    titles: ['Morning run'],
    dayOfWeekHistogram: day,
    hourHistogram: hour,
    occurrences: 4,
    lastOccurrence: '2026-04-06',
    confidence: 1,
  };
}

/**
 * Minimal mock of OpenRouterClient.
 * Only the `complete` method is needed by `enrichWithLlm`.
 */
type CompleteResult = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: AiError };

function mockClient(impl: (req: { prompt: string }) => CompleteResult) {
  return {
    complete: vi.fn(async (req: { prompt: string }) => impl(req)),
  } as unknown as Parameters<typeof enrichWithLlm>[1];
}

describe('enrichWithLlm()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns LLM recommendations when the response is valid JSON', async () => {
    const validJson = JSON.stringify({
      recommendations: [
        {
          title: 'Go running',
          rationale: 'You run every Monday morning.',
          suggestedDate: '2026-04-13',
          suggestedStartHour: 8,
          suggestedDurationMinutes: 45,
        },
      ],
    });
    const client = mockClient(() => ok(validJson));

    const result = await enrichWithLlm([makePattern()], client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].title).toBe('Go running');
      expect(result.value[0].source).toBe('llm');
    }
  });

  it('returns empty array on LLM failure (offline, rate-limit, etc)', async () => {
    const client = mockClient(() =>
      err<AiError>({ kind: 'ai/offline' }),
    );

    const result = await enrichWithLlm([makePattern()], client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns empty array when LLM response is not valid JSON', async () => {
    const client = mockClient(() => ok('This is not JSON'));

    const result = await enrichWithLlm([makePattern()], client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns empty array when JSON does not match expected schema', async () => {
    const badSchema = JSON.stringify({ wrong: 'schema' });
    const client = mockClient(() => ok(badSchema));

    const result = await enrichWithLlm([makePattern()], client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns empty array for empty pattern list', async () => {
    const client = mockClient(() => ok('irrelevant'));

    const result = await enrichWithLlm([], client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
    // Should not even call the client.
    expect(client.complete).not.toHaveBeenCalled();
  });
});
