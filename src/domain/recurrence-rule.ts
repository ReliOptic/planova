/** Recurrence frequency for a task. */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

/**
 * RecurrenceRule — defines how a task repeats.
 *
 * - `frequency`: daily, weekly, or monthly.
 * - `interval`: every N periods (e.g., interval=2 + weekly = every 2 weeks). Must be >= 1.
 * - `daysOfWeek`: for weekly frequency, which days (0=Sun … 6=Sat). Ignored for daily/monthly.
 * - `endDate`: optional YYYY-MM-DD after which recurrence stops.
 */
export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency;
  readonly interval: number;
  readonly daysOfWeek?: readonly number[];
  readonly endDate?: string;
}

const VALID_FREQUENCIES: ReadonlySet<string> = new Set<RecurrenceFrequency>([
  'daily',
  'weekly',
  'monthly',
]);

/** Validate a RecurrenceRule. Returns null if valid, error string if not. */
export function validateRecurrenceRule(rule: RecurrenceRule): string | null {
  if (!VALID_FREQUENCIES.has(rule.frequency)) {
    return `frequency must be one of: ${[...VALID_FREQUENCIES].join(', ')}`;
  }
  if (!Number.isInteger(rule.interval) || rule.interval < 1) {
    return 'interval must be an integer >= 1';
  }
  if (rule.daysOfWeek !== undefined) {
    if (!Array.isArray(rule.daysOfWeek) || rule.daysOfWeek.length === 0) {
      return 'daysOfWeek must be a non-empty array';
    }
    for (const d of rule.daysOfWeek) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        return 'daysOfWeek values must be integers 0-6';
      }
    }
  }
  if (rule.endDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(rule.endDate)) {
    return 'endDate must be YYYY-MM-DD';
  }
  return null;
}

/**
 * Compute the next occurrence date after `fromDate` (YYYY-MM-DD) based on the rule.
 * Returns YYYY-MM-DD or null if past endDate.
 */
export function getNextOccurrence(rule: RecurrenceRule, fromDate: string): string | null {
  const from = new Date(fromDate + 'T00:00:00');

  let next: Date;

  switch (rule.frequency) {
    case 'daily':
      next = new Date(from);
      next.setDate(next.getDate() + rule.interval);
      break;

    case 'weekly':
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        next = findNextWeekday(from, rule.daysOfWeek, rule.interval);
      } else {
        next = new Date(from);
        next.setDate(next.getDate() + 7 * rule.interval);
      }
      break;

    case 'monthly':
      next = new Date(from);
      next.setMonth(next.getMonth() + rule.interval);
      break;

    default:
      return null;
  }

  const nextStr = formatDate(next);

  if (rule.endDate && nextStr > rule.endDate) {
    return null;
  }

  return nextStr;
}

/** Find the next matching weekday after `from`, considering interval weeks. */
function findNextWeekday(from: Date, daysOfWeek: readonly number[], interval: number): Date {
  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  const currentDay = from.getDay();

  // Try to find a later day in the same week
  for (const day of sorted) {
    if (day > currentDay) {
      const diff = day - currentDay;
      const next = new Date(from);
      next.setDate(next.getDate() + diff);
      return next;
    }
  }

  // No later day this week — jump to the first matching day in the next interval week
  const daysUntilNextWeek = 7 * interval - currentDay + sorted[0];
  const next = new Date(from);
  next.setDate(next.getDate() + daysUntilNextWeek);
  return next;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
