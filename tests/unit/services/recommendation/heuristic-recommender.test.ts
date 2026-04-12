import { describe, it, expect } from 'vitest';
import { toRecommendations } from '../../../../src/services/recommendation/heuristic-recommender';
import type { DetectedPattern } from '../../../../src/services/recommendation/types';

function makePattern(overrides: Partial<DetectedPattern> = {}): DetectedPattern {
  const day = Array.from<number>({ length: 7 }).fill(0);
  day[1] = 4; // Monday
  const hour = Array.from<number>({ length: 24 }).fill(0);
  hour[8] = 4; // 08:00

  return {
    id: 'wt-test',
    kind: 'weekday-time',
    label: '매주 월요일 08:00',
    titles: ['Morning run'],
    dayOfWeekHistogram: day,
    hourHistogram: hour,
    occurrences: 4,
    lastOccurrence: '2026-04-06',
    confidence: 1,
    ...overrides,
  };
}

describe('toRecommendations()', () => {
  it('produces a heuristic recommendation from a weekday-time pattern', () => {
    const pattern = makePattern();
    // nowDate is Wednesday 2026-04-08, next Monday is 2026-04-13
    const recs = toRecommendations([pattern], '2026-04-08');

    expect(recs).toHaveLength(1);
    const rec = recs[0];
    expect(rec.patternId).toBe('wt-test');
    expect(rec.source).toBe('heuristic');
    expect(rec.title).toBe('Morning run');
    expect(rec.suggestedDate).toBe('2026-04-13'); // next Monday
    expect(rec.suggestedStartHour).toBe(8);
    expect(rec.suggestedDurationMinutes).toBe(60);
    expect(rec.rationale).toContain('4회');
  });

  it('produces a recurring-title recommendation', () => {
    const pattern: DetectedPattern = {
      ...makePattern(),
      id: 'rt-test',
      kind: 'recurring-title',
      label: '반복: "standup"',
      titles: ['standup'],
      occurrences: 5,
    };

    const recs = toRecommendations([pattern], '2026-04-08');
    expect(recs).toHaveLength(1);
    expect(recs[0].rationale).toContain('이번 주에도');
    expect(recs[0].source).toBe('heuristic');
  });

  it('produces a title-cluster recommendation', () => {
    const pattern: DetectedPattern = {
      ...makePattern(),
      id: 'tc-test',
      kind: 'title-cluster',
      label: '유사 작업 그룹: "code review"',
      titles: ['code review'],
      occurrences: 3,
    };

    const recs = toRecommendations([pattern], '2026-04-08');
    expect(recs).toHaveLength(1);
    expect(recs[0].rationale).toContain('3회');
  });

  it('returns at most 5 recommendations', () => {
    const patterns = Array.from({ length: 10 }, (_, i) =>
      makePattern({ id: `wt-${i}`, occurrences: 4 + i }),
    );

    const recs = toRecommendations(patterns, '2026-04-08');
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it('returns an empty array for no patterns', () => {
    expect(toRecommendations([], '2026-04-08')).toEqual([]);
  });

  it('suggests today when peak day matches nowDate', () => {
    // nowDate is Monday 2026-04-13 → peak day = Monday → suggestedDate = today
    const pattern = makePattern(); // peak day = Monday (1)
    const recs = toRecommendations([pattern], '2026-04-13');
    expect(recs[0].suggestedDate).toBe('2026-04-13');
  });
});
