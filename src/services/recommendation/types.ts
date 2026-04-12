/**
 * Value objects used by the recommendation pipeline.
 *
 * These are service-layer types — deliberately not Dexie domain entities.
 * Recommendation results are transient (recomputed on each check), only the
 * "hidden pattern" cooldown is persisted in the `meta` table.
 */

/** A single completed-history row ready for pattern analysis. */
export interface HistoryRow {
  readonly taskId: string;
  readonly title: string;
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly scheduledDate: string;  // YYYY-MM-DD
  readonly startTime: string;      // ISO 8601 UTC
  readonly endTime: string;        // ISO 8601 UTC
  readonly completedAt: number;    // Unix epoch ms
}

/** Discriminated pattern kind. */
export type PatternKind = 'weekday-time' | 'recurring-title' | 'title-cluster';

/** A detected recurrence pattern in the user's completion history. */
export interface DetectedPattern {
  readonly id: string;
  readonly kind: PatternKind;
  /** Human-readable label, e.g. "매주 월/수/금 08:00–09:00". */
  readonly label: string;
  /** Sample task titles that fed this pattern (max 5). */
  readonly titles: readonly string[];
  /** 7 entries — occurrence count per day of week (0 = Sunday). */
  readonly dayOfWeekHistogram: readonly number[];
  /** 24 entries — occurrence count per hour of day. */
  readonly hourHistogram: readonly number[];
  /** Total number of matching occurrences in the lookback window. */
  readonly occurrences: number;
  /** YYYY-MM-DD of the most recent match. */
  readonly lastOccurrence: string;
  /** Confidence score 0..1 (occurrences / lookbackWeeks, capped). */
  readonly confidence: number;
}

/** Source of the recommendation. */
export type RecommendationSource = 'heuristic' | 'llm';

/** A concrete task suggestion generated from a pattern. */
export interface Recommendation {
  readonly id: string;
  readonly patternId: string;
  readonly title: string;
  readonly rationale: string;
  readonly suggestedDate?: string;          // YYYY-MM-DD
  readonly suggestedStartHour?: number;
  readonly suggestedDurationMinutes?: number;
  readonly source: RecommendationSource;
}
