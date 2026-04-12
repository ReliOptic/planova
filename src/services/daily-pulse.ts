import type { TaskViewModel } from './task-view-model';
import { addDays } from '../utils/date-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GapSegment {
  /** Start hour (fractional) in local time, e.g. 10.5 = 10:30. */
  readonly startHour: number;
  /** End hour (fractional) in local time. */
  readonly endHour: number;
  /** Duration in minutes. */
  readonly durationMinutes: number;
}

export interface DailyPulseData {
  /** YYYY-MM-DD for which this pulse was computed. */
  readonly date: string;
  /** Plan accuracy ratio 0–1. null when fewer than 1 completed task. */
  readonly accuracy: number | null;
  /** Sum of planned durations across completed tasks (minutes). */
  readonly totalPlannedMinutes: number;
  /** Sum of actual durations across completed tasks (minutes). */
  readonly totalActualMinutes: number;
  /** Free-time gaps between scheduled blocks (requires ≥2 completed tasks). */
  readonly gapSegments: GapSegment[];
  /** Task with the largest positive deviation (over time). null when <1 task. */
  readonly mostOverTask: TaskViewModel | null;
  /** Task with the smallest absolute deviation (most accurate). null when <2 tasks. */
  readonly mostAccurateTask: TaskViewModel | null;
  /** Weekly accuracy trend. Empty when fewer than 3 days of data. */
  readonly weeklyAccuracy: Array<{ date: string; accuracy: number }>;
  /** Streak in days and whether today used a freeze. */
  readonly streak: { days: number; hasFreezeToday: boolean };
  /** Number of completed tasks for the day. */
  readonly completedCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get completed tasks for a specific YYYY-MM-DD date. */
function completedOnDate(tasks: TaskViewModel[], date: string): TaskViewModel[] {
  return tasks.filter(
    (t) =>
      t.status === 'Completed' &&
      t.actualDurationMinutes !== undefined &&
      t.completedScheduledDate === date,
  );
}

/** Get unique YYYY-MM-DD dates that have at least 1 completed task. */
function completedDates(tasks: TaskViewModel[]): Set<string> {
  const dates = new Set<string>();
  for (const t of tasks) {
    if (t.status === 'Completed' && t.completedScheduledDate) {
      dates.add(t.completedScheduledDate);
    }
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Core computations
// ---------------------------------------------------------------------------

/**
 * Compute plan accuracy for a set of completed tasks.
 * Formula: 1 - abs(Σdeviation) / Σplanned
 * Returns null when no tasks with actualDurationMinutes are present.
 */
export function computeAccuracy(tasks: TaskViewModel[]): number | null {
  const valid = tasks.filter((t) => t.actualDurationMinutes !== undefined);
  if (valid.length === 0) return null;

  let sumPlanned = 0;
  let sumAbsDeviation = 0;
  for (const t of valid) {
    const planned = t.durationMinutes;
    const actual = t.actualDurationMinutes!;
    sumPlanned += planned;
    sumAbsDeviation += Math.abs(actual - planned);
  }
  if (sumPlanned === 0) return 1;
  return Math.max(0, 1 - sumAbsDeviation / sumPlanned);
}

/**
 * Compute gap segments between schedule blocks within work hours.
 * Requires at least 2 blocks to detect meaningful gaps.
 * All time parameters are local hours (fractional).
 */
export function computeGapSegments(
  blocks: Array<{ startTime: string; endTime: string }>,
  workStart: number,
  workEnd: number,
): GapSegment[] {
  if (blocks.length < 2) return [];

  // Convert ISO times to local fractional hours
  const intervals = blocks
    .map((b) => {
      const s = new Date(b.startTime);
      const e = new Date(b.endTime);
      return {
        start: s.getHours() + s.getMinutes() / 60,
        end: e.getHours() + e.getMinutes() / 60,
      };
    })
    .sort((a, b) => a.start - b.start);

  const gaps: GapSegment[] = [];
  let cursor = workStart;

  for (const interval of intervals) {
    const gapStart = Math.max(cursor, workStart);
    const gapEnd = Math.min(interval.start, workEnd);
    const dur = Math.round((gapEnd - gapStart) * 60);
    if (dur >= 15) {
      gaps.push({ startHour: gapStart, endHour: gapEnd, durationMinutes: dur });
    }
    cursor = Math.max(cursor, interval.end);
  }

  // Gap after last block to work end
  const trailingStart = Math.max(cursor, workStart);
  const trailingEnd = workEnd;
  const trailingDur = Math.round((trailingEnd - trailingStart) * 60);
  if (trailingDur >= 15 && trailingStart < trailingEnd) {
    gaps.push({ startHour: trailingStart, endHour: trailingEnd, durationMinutes: trailingDur });
  }

  return gaps;
}

/**
 * Compute accuracy for each of the last 7 calendar days ending on endDate.
 * Only days with at least 1 completed task are included.
 * Returns empty array when fewer than 3 qualifying days exist.
 */
export function computeWeeklyAccuracy(
  tasks: TaskViewModel[],
  endDate: string,
): Array<{ date: string; accuracy: number }> {
  const result: Array<{ date: string; accuracy: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const date = addDays(endDate, -i);
    const dayTasks = completedOnDate(tasks, date);
    const acc = computeAccuracy(dayTasks);
    if (acc !== null) {
      result.push({ date, accuracy: acc });
    }
  }

  if (result.length < 3) return [];
  return result;
}

/**
 * Compute current streak (consecutive days with ≥1 completed task).
 * Streak Freeze: one missed day does not break the streak.
 */
export function computeStreak(
  tasks: TaskViewModel[],
  today: string,
): { days: number; hasFreezeToday: boolean } {
  const datesWithCompletion = completedDates(tasks);

  // Walk backwards from today
  let days = 0;
  let hasFreezeToday = false;
  let usedFreeze = false;
  let date = today;

  for (let i = 0; i < 365; i++) {
    const current = addDays(today, -i);

    if (datesWithCompletion.has(current)) {
      days++;
      date = current;
    } else if (!usedFreeze) {
      // Allow one freeze miss — but only if we've already started a streak
      // and it's not the very first day (today)
      if (i === 0) {
        // Today itself has no completions — no streak yet
        hasFreezeToday = false;
        // Continue to check yesterday
        usedFreeze = true;
      } else if (days > 0) {
        // Freeze a missed day in the middle of an existing streak
        usedFreeze = true;
        hasFreezeToday = i === 0;
      } else {
        // No streak started yet — stop
        break;
      }
    } else {
      // Two consecutive misses — streak ends
      break;
    }
    void date;
  }

  return { days, hasFreezeToday };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute the full DailyPulseData for a given date.
 * Returns null when no completed tasks exist for the date.
 */
export function computeDailyPulse(
  tasks: TaskViewModel[],
  blocks: Array<{ startTime: string; endTime: string }>,
  date: string,
  workStart: number,
  workEnd: number,
): DailyPulseData | null {
  const dayTasks = completedOnDate(tasks, date);

  if (dayTasks.length === 0) return null;

  const accuracy = computeAccuracy(dayTasks);
  const totalPlannedMinutes = dayTasks.reduce((s, t) => s + t.durationMinutes, 0);
  const totalActualMinutes = dayTasks.reduce((s, t) => s + (t.actualDurationMinutes ?? t.durationMinutes), 0);

  const gapSegments =
    dayTasks.length >= 2 ? computeGapSegments(blocks, workStart, workEnd) : [];

  // Most over task: largest positive deviation
  const mostOverTask =
    dayTasks.length >= 1
      ? dayTasks.reduce<TaskViewModel | null>((best, t) => {
          const dev = t.deviationMinutes ?? 0;
          if (dev <= 0) return best;
          if (best === null) return t;
          return dev > (best.deviationMinutes ?? 0) ? t : best;
        }, null)
      : null;

  // Most accurate task: smallest absolute deviation (requires ≥2 tasks)
  const mostAccurateTask =
    dayTasks.length >= 2
      ? dayTasks.reduce<TaskViewModel>((best, t) => {
          const bestAbs = Math.abs(best.deviationMinutes ?? 0);
          const tAbs = Math.abs(t.deviationMinutes ?? 0);
          return tAbs < bestAbs ? t : best;
        }, dayTasks[0])
      : null;

  const weeklyAccuracy = computeWeeklyAccuracy(tasks, date);
  const streak = computeStreak(tasks, date);

  return {
    date,
    accuracy,
    totalPlannedMinutes,
    totalActualMinutes,
    gapSegments,
    mostOverTask,
    mostAccurateTask,
    weeklyAccuracy,
    streak,
    completedCount: dayTasks.length,
  };
}
