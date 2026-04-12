import { describe, it, expect } from 'vitest';
import {
  detectPatterns,
  normalizeTitle,
  jaccardSimilarity,
  MIN_COMPLETED_COUNT,
} from '../../../../src/services/recommendation/pattern-detector';
import type { HistoryRow } from '../../../../src/services/recommendation/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a history row on a given date + hour. Day of week is derived from the date. */
function row(
  date: string,
  hour: number,
  title: string = 'workout',
  overrides: Partial<HistoryRow> = {},
): HistoryRow {
  const startTime = `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const endTime = `${date}T${String(hour + 1).padStart(2, '0')}:00:00.000Z`;
  return {
    taskId: `t-${date}-${hour}-${title}`,
    title,
    priority: 'Medium',
    scheduledDate: date,
    startTime,
    endTime,
    completedAt: Date.parse(endTime),
    ...overrides,
  };
}

// ─── normalizeTitle ─────────────────────────────────────────────────────────

describe('normalizeTitle()', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeTitle('  Morning  RUN  ')).toBe('morning run');
  });
});

// ─── jaccardSimilarity ──────────────────────────────────────────────────────

describe('jaccardSimilarity()', () => {
  it('returns 1 for identical sets', () => {
    const a = new Set(['a', 'b', 'c']);
    expect(jaccardSimilarity(a, a)).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccardSimilarity(new Set(['a']), new Set(['b']))).toBe(0);
  });

  it('returns correct ratio for overlapping sets', () => {
    // intersection = {b}, union = {a, b, c} → 1/3
    expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
  });

  it('returns 0 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });
});

// ─── detectPatterns ─────────────────────────────────────────────────────────

describe('detectPatterns()', () => {
  it('returns empty when fewer than MIN_COMPLETED_COUNT rows', () => {
    const rows = Array.from({ length: MIN_COMPLETED_COUNT - 1 }, (_, i) =>
      row(`2026-04-0${i + 1}`, 8),
    );
    expect(detectPatterns(rows)).toEqual([]);
  });

  it('detects a weekday-time pattern for ≥ 4 same (day, hour) occurrences', () => {
    // 4 Mondays at 08:00 (2026-04-06 is a Monday)
    const mondays = [
      row('2026-03-16', 8), // Monday
      row('2026-03-23', 8), // Monday
      row('2026-03-30', 8), // Monday
      row('2026-04-06', 8), // Monday
    ];
    // Pad to reach MIN_COMPLETED_COUNT with unrelated rows
    const padding = Array.from({ length: MIN_COMPLETED_COUNT - mondays.length }, (_, i) =>
      row('2026-04-07', 10 + i, `filler-${i}`),
    );

    const patterns = detectPatterns([...mondays, ...padding]);
    const wt = patterns.filter((p) => p.kind === 'weekday-time');
    expect(wt.length).toBeGreaterThanOrEqual(1);
    const first = wt[0];
    expect(first.occurrences).toBe(4);
    expect(first.label).toContain('월');
  });

  it('detects a recurring-title pattern for ≥ 3 identical normalised titles', () => {
    const rows = [
      row('2026-03-16', 8, 'standup meeting'),
      row('2026-03-17', 8, 'Standup Meeting'),
      row('2026-03-18', 8, 'standup   meeting'),
      // Pad to MIN_COMPLETED_COUNT
      ...Array.from({ length: MIN_COMPLETED_COUNT - 3 }, (_, i) =>
        row('2026-04-07', 10 + i, `filler-${i}`),
      ),
    ];

    const patterns = detectPatterns(rows);
    const rt = patterns.filter((p) => p.kind === 'recurring-title');
    expect(rt.length).toBeGreaterThanOrEqual(1);
    expect(rt[0].occurrences).toBe(3);
    expect(rt[0].label).toContain('standup meeting');
  });

  it('detects a title-cluster for ≥ 3 titles with Jaccard ≥ 0.6', () => {
    // Jaccard("code review", "code review report") = 2/3 ≈ 0.67 ≥ 0.6
    const rows = [
      row('2026-03-16', 9, 'code review'),
      row('2026-03-17', 9, 'code review report'),
      row('2026-03-18', 9, 'code review notes'),
      ...Array.from({ length: MIN_COMPLETED_COUNT - 3 }, (_, i) =>
        row('2026-04-07', 10 + i, `unrelated-filler-${i}`),
      ),
    ];

    const patterns = detectPatterns(rows);
    const tc = patterns.filter((p) => p.kind === 'title-cluster');
    expect(tc.length).toBeGreaterThanOrEqual(1);
    expect(tc[0].occurrences).toBe(3);
  });

  it('sorts results by confidence descending', () => {
    // Build 5 matching weekday-time entries (high confidence) + 3 recurring-title (lower)
    const mondays = Array.from({ length: 5 }, (_, i) =>
      row(`2026-03-${String(10 + i * 7).padStart(2, '0')}`, 7, 'morning run'),
    );
    const others = Array.from({ length: 5 }, (_, i) =>
      row(`2026-04-0${i + 1}`, 14, `unique-${i}`),
    );

    const patterns = detectPatterns([...mondays, ...others]);
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
    }
  });

  it('deduplicates patterns by id', () => {
    // Identical rows produce the same pattern id from multiple detectors
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(`2026-03-${String(16 + i).padStart(2, '0')}`, 8, 'workout'),
    );
    const patterns = detectPatterns(rows);
    const ids = patterns.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
