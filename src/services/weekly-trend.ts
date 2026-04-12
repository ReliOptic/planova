import type { Task } from '../domain/task';

export interface DayAccuracy {
  /** YYYY-MM-DD */
  date: string;
  /** Korean day-of-week label: 월, 화, 수, 목, 금, 토, 일 */
  dayLabel: string;
  /**
   * 0–100 accuracy score, or null when no tasks with actualDurationMinutes
   * were completed on this day.
   */
  accuracy: number | null;
  completedCount: number;
}

export interface WeeklyTrendData {
  days: DayAccuracy[];
  /** 0–100 average over days that have data (accuracy !== null). */
  weekAverage: number;
}

const KOREAN_DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Add `n` days to a YYYY-MM-DD string without timezone shift. */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Return the Korean day label for a YYYY-MM-DD string. */
function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return KOREAN_DAY_LABELS[day];
}

/**
 * computeWeeklyTrend — computes daily planning accuracy for the 7 days ending
 * on `endDate` (inclusive).
 *
 * Only tasks that have `actualDurationMinutes` set are counted.
 * Accuracy formula per day:
 *   accuracy = max(0, 1 - |Σdeviation| / Σplanned) * 100
 * where deviation = actualDurationMinutes − durationMinutes.
 *
 * Days with no qualifying completions receive `accuracy: null`.
 *
 * @param tasks   All completed tasks to consider.
 * @param endDate YYYY-MM-DD — the last (most recent) day of the 7-day window.
 */
export function computeWeeklyTrend(tasks: readonly Task[], endDate: string): WeeklyTrendData {
  // Build the 7-day window: [endDate-6, ..., endDate]
  const startDate = addDays(endDate, -6);

  // Index tasks by completedScheduledDate (preferred) or fall back to
  // extracting YYYY-MM-DD from completedAt.
  const byDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.actualDurationMinutes === undefined) continue;

    const dateKey =
      task.completedScheduledDate ??
      (task.completedAt != null
        ? new Date(task.completedAt).toISOString().slice(0, 10)
        : null);

    if (dateKey === null || dateKey < startDate || dateKey > endDate) continue;

    const bucket = byDate.get(dateKey);
    if (bucket) {
      bucket.push(task);
    } else {
      byDate.set(dateKey, [task]);
    }
  }

  const days: DayAccuracy[] = [];
  let sumAccuracy = 0;
  let daysWithData = 0;

  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i);
    const bucket = byDate.get(date) ?? [];

    if (bucket.length === 0) {
      days.push({ date, dayLabel: dayLabel(date), accuracy: null, completedCount: 0 });
      continue;
    }

    let totalPlanned = 0;
    let totalDeviation = 0;
    for (const task of bucket) {
      totalPlanned += task.durationMinutes;
      totalDeviation += (task.actualDurationMinutes ?? task.durationMinutes) - task.durationMinutes;
    }

    const accuracy =
      totalPlanned === 0
        ? 100
        : Math.max(0, (1 - Math.abs(totalDeviation) / totalPlanned)) * 100;

    days.push({ date, dayLabel: dayLabel(date), accuracy, completedCount: bucket.length });
    sumAccuracy += accuracy;
    daysWithData++;
  }

  const weekAverage = daysWithData === 0 ? 0 : Math.round(sumAccuracy / daysWithData);

  return { days, weekAverage };
}
