import type { DetectedPattern, HistoryRow, PatternKind } from './types';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Lookback window in days. Only rows within this window are analysed. */
export const LOOKBACK_DAYS = 28;

/** Minimum completed blocks required before the pipeline activates. */
export const MIN_COMPLETED_COUNT = 10;

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Normalise a task title for clustering: lowercase, trim, collapse spaces. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Simple deterministic hash for pattern id generation. */
function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function patternId(kind: PatternKind, keys: string): string {
  return `${kind}-${simpleHash(keys)}`;
}

/** Jaccard similarity of two token sets. */
export function jaccardSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(title: string): ReadonlySet<string> {
  return new Set(normalizeTitle(title).split(' ').filter(Boolean));
}

/** Map day index (0–6) to Korean label. */
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function buildHistograms(rows: readonly HistoryRow[]): {
  dayOfWeek: number[];
  hour: number[];
} {
  const dayOfWeek = Array.from<number>({ length: 7 }).fill(0);
  const hour = Array.from<number>({ length: 24 }).fill(0);
  for (const r of rows) {
    const d = new Date(r.startTime);
    dayOfWeek[d.getUTCDay()]++;
    hour[d.getUTCHours()]++;
  }
  return { dayOfWeek, hour };
}

function lastDate(rows: readonly HistoryRow[]): string {
  let max = '';
  for (const r of rows) {
    if (r.scheduledDate > max) max = r.scheduledDate;
  }
  return max;
}

function sampleTitles(rows: readonly HistoryRow[], max = 5): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of rows) {
    if (!seen.has(r.title) && result.length < max) {
      seen.add(r.title);
      result.push(r.title);
    }
  }
  return result;
}

// ─── Detectors ──────────────────────────────────────────────────────────────

/**
 * weekday-time — same day-of-week + hour bucket appearing ≥ 4 times.
 *
 * Groups by (dayOfWeek, hourBucket) where hourBucket is the UTC hour of
 * startTime. Any group with ≥ 4 members becomes a pattern.
 */
function detectWeekdayTime(
  rows: readonly HistoryRow[],
  lookbackWeeks: number,
): DetectedPattern[] {
  const groups = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const d = new Date(r.startTime);
    const key = `${d.getUTCDay()}-${d.getUTCHours()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(r);
    } else {
      groups.set(key, [r]);
    }
  }

  const patterns: DetectedPattern[] = [];
  for (const [key, members] of groups) {
    if (members.length < 4) continue;
    const [dayStr, hourStr] = key.split('-');
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const histograms = buildHistograms(members);

    patterns.push({
      id: patternId('weekday-time', key),
      kind: 'weekday-time',
      label: `매주 ${DAY_LABELS[day]}요일 ${String(hour).padStart(2, '0')}:00`,
      titles: sampleTitles(members),
      dayOfWeekHistogram: histograms.dayOfWeek,
      hourHistogram: histograms.hour,
      occurrences: members.length,
      lastOccurrence: lastDate(members),
      confidence: Math.min(1, members.length / lookbackWeeks),
    });
  }
  return patterns;
}

/**
 * recurring-title — same normalised title appearing ≥ 3 times.
 */
function detectRecurringTitle(
  rows: readonly HistoryRow[],
  lookbackWeeks: number,
): DetectedPattern[] {
  const groups = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const norm = normalizeTitle(r.title);
    const existing = groups.get(norm);
    if (existing) {
      existing.push(r);
    } else {
      groups.set(norm, [r]);
    }
  }

  const patterns: DetectedPattern[] = [];
  for (const [norm, members] of groups) {
    if (members.length < 3) continue;
    const histograms = buildHistograms(members);

    patterns.push({
      id: patternId('recurring-title', norm),
      kind: 'recurring-title',
      label: `반복: "${members[0].title}"`,
      titles: sampleTitles(members),
      dayOfWeekHistogram: histograms.dayOfWeek,
      hourHistogram: histograms.hour,
      occurrences: members.length,
      lastOccurrence: lastDate(members),
      confidence: Math.min(1, members.length / lookbackWeeks),
    });
  }
  return patterns;
}

/**
 * title-cluster — groups of ≥ 3 distinct-title rows whose titles have
 * Jaccard token similarity ≥ 0.6.
 *
 * Greedy clustering: iterate rows; for each, try to join the first existing
 * cluster whose representative has similarity ≥ threshold. Otherwise start a
 * new cluster. After grouping, emit patterns for clusters of size ≥ 3.
 */
function detectTitleCluster(
  rows: readonly HistoryRow[],
  lookbackWeeks: number,
): DetectedPattern[] {
  const THRESHOLD = 0.6;
  const clusters: { representative: ReadonlySet<string>; label: string; members: HistoryRow[] }[] = [];

  for (const r of rows) {
    const tokens = tokenize(r.title);
    let placed = false;
    for (const cluster of clusters) {
      if (jaccardSimilarity(tokens, cluster.representative) >= THRESHOLD) {
        cluster.members.push(r);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ representative: tokens, label: r.title, members: [r] });
    }
  }

  const patterns: DetectedPattern[] = [];
  for (const cluster of clusters) {
    if (cluster.members.length < 3) continue;
    const histograms = buildHistograms(cluster.members);

    patterns.push({
      id: patternId('title-cluster', [...cluster.representative].sort().join('|')),
      kind: 'title-cluster',
      label: `유사 작업 그룹: "${cluster.label}"`,
      titles: sampleTitles(cluster.members),
      dayOfWeekHistogram: histograms.dayOfWeek,
      hourHistogram: histograms.hour,
      occurrences: cluster.members.length,
      lastOccurrence: lastDate(cluster.members),
      confidence: Math.min(1, cluster.members.length / lookbackWeeks),
    });
  }
  return patterns;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run all three detectors against the provided history and return a deduplicated
 * list of detected patterns sorted by confidence descending.
 *
 * Call this with pre-filtered rows (lookback window applied, only completed tasks).
 */
export function detectPatterns(rows: readonly HistoryRow[]): readonly DetectedPattern[] {
  if (rows.length < MIN_COMPLETED_COUNT) return [];
  const lookbackWeeks = Math.max(1, LOOKBACK_DAYS / 7);

  const all = [
    ...detectWeekdayTime(rows, lookbackWeeks),
    ...detectRecurringTitle(rows, lookbackWeeks),
    ...detectTitleCluster(rows, lookbackWeeks),
  ];

  // Deduplicate by id (different detectors may produce the same pattern id).
  const seen = new Set<string>();
  const unique: DetectedPattern[] = [];
  for (const p of all) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }

  return unique.sort((a, b) => b.confidence - a.confidence);
}
