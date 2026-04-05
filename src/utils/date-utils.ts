/**
 * Date utilities for Planova.
 * All times stored as UTC ISO 8601, rendered in user's local timezone.
 * Dates (due, scheduledDate) stored as YYYY-MM-DD strings.
 */

/** Validate and return a YYYY-MM-DD string, or null if invalid */
export function parseISODate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null; // invalid date like 2026-02-30
  }
  return value;
}

/** Parse a duration string like "2h 30m", "45m", "1h" into minutes. Returns 0 for unparseable. */
export function parseDuration(value: string | number): number {
  if (typeof value === 'number') return value;
  const str = String(value).trim().toLowerCase();

  let total = 0;
  const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
  const minMatch = str.match(/(\d+)\s*m/);

  if (hourMatch) {
    total += parseFloat(hourMatch[1]) * 60;
  }
  if (minMatch) {
    total += parseInt(minMatch[1], 10);
  }

  // Handle plain number (assume minutes)
  if (total === 0 && /^\d+$/.test(str)) {
    total = parseInt(str, 10);
  }

  return Math.round(total);
}

/** Get today's date as YYYY-MM-DD in local timezone */
export function getLocalToday(): string {
  const d = new Date();
  return formatLocalDate(d);
}

/** Format a Date object as YYYY-MM-DD in local timezone */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Build a UTC ISO string from a local date (YYYY-MM-DD) and hour/minute offset */
export function buildUTCTime(localDate: string, hours: number, minutes: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const local = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return local.toISOString();
}

/** Parse a UTC ISO string and return the local hour and minute */
export function getLocalHourMinute(utcISO: string): { hour: number; minute: number } {
  const d = new Date(utcISO);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

/**
 * Compute pixel offset from the top of the timeline.
 * @param utcISO - UTC ISO start time string
 * @param workStartHour - timeline start hour (e.g. 9 for 9am)
 * @param slotHeightPx - height in pixels per hour (default 80)
 * @returns pixel offset, can be negative if before work hours
 */
export function computePosition(
  utcISO: string,
  workStartHour: number,
  slotHeightPx: number = 80
): number {
  const { hour, minute } = getLocalHourMinute(utcISO);
  const minutesSinceStart = (hour - workStartHour) * 60 + minute;
  return (minutesSinceStart / 60) * slotHeightPx;
}

/**
 * Compute the pixel height for a task block based on duration.
 * @param durationMinutes - task duration in minutes
 * @param slotHeightPx - height in pixels per hour (default 80)
 * @returns height in pixels
 */
export function computeBlockHeight(
  durationMinutes: number,
  slotHeightPx: number = 80
): number {
  return (durationMinutes / 60) * slotHeightPx;
}

/** Format a UTC ISO string for display: "10:00 AM" in local timezone */
export function formatTimeDisplay(utcISO: string): string {
  const d = new Date(utcISO);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Format a YYYY-MM-DD date for display: "Saturday, April 5, 2026" */
export function formatDateHeadline(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a YYYY-MM-DD due date as a human-readable string.
 * Returns "Today", "Tomorrow", "Yesterday", or "Apr 7" for other dates.
 */
export function formatDueDate(dateStr: string): string {
  const today = getLocalToday();
  if (dateStr === today) return 'Today';

  const tomorrow = addDays(today, 1);
  if (dateStr === tomorrow) return 'Tomorrow';

  const yesterday = addDays(today, -1);
  if (dateStr === yesterday) return 'Yesterday';

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Navigate a YYYY-MM-DD date by N days */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/** Get the current time marker position in pixels */
export function getCurrentTimePosition(
  workStartHour: number,
  slotHeightPx: number = 80
): number {
  const now = new Date();
  const minutesSinceStart = (now.getHours() - workStartHour) * 60 + now.getMinutes();
  return (minutesSinceStart / 60) * slotHeightPx;
}

/** Check if a UTC ISO time is past (overdue) */
export function isPastTime(utcISO: string): boolean {
  return new Date(utcISO).getTime() < Date.now();
}

/**
 * Format a duration in minutes to a human-readable string.
 * Under 60 → "{n} min", exactly 60 → "1 hr", over 60 → "{n} hrs" (with .5 for 30-min increments).
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = minutes / 60;
  if (hours === 1) {
    return '1 hr';
  }
  const display = Number.isInteger(hours) ? hours : parseFloat(hours.toFixed(1));
  return `${display} hrs`;
}

/** Generate duration options for the select dropdown (15-min increments up to 8h) */
export function getDurationOptions(): Array<{ label: string; value: number }> {
  const options: Array<{ label: string; value: number }> = [];
  for (let minutes = 15; minutes <= 480; minutes += 15) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let label: string;
    if (h === 0) {
      label = `${m}m`;
    } else if (m === 0) {
      label = `${h}h`;
    } else {
      label = `${h}h ${m}m`;
    }
    options.push({ label, value: minutes });
  }
  return options;
}

