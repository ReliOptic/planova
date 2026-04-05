/**
 * Settings utilities. Work hours stored in localStorage.
 * Phase 4 will add API key storage here.
 */

interface WorkHours {
  readonly start: number; // hour (e.g. 9)
  readonly end: number; // hour (e.g. 18)
}

const WORK_HOURS_KEY = 'planova_work_hours';
const DEFAULT_WORK_HOURS: WorkHours = { start: 9, end: 18 };

export function getWorkHours(): WorkHours {
  try {
    const raw = localStorage.getItem(WORK_HOURS_KEY);
    if (!raw) return DEFAULT_WORK_HOURS;
    const parsed = JSON.parse(raw) as WorkHours;
    if (
      typeof parsed.start !== 'number' ||
      typeof parsed.end !== 'number' ||
      parsed.start < 0 ||
      parsed.start > 23 ||
      parsed.end < 1 ||
      parsed.end > 24 ||
      parsed.start >= parsed.end
    ) {
      return DEFAULT_WORK_HOURS;
    }
    return parsed;
  } catch {
    return DEFAULT_WORK_HOURS;
  }
}

export interface SaveWorkHoursResult {
  readonly success: boolean;
  readonly error?: string;
}

export function saveWorkHours(hours: WorkHours): SaveWorkHoursResult {
  if (hours.start >= hours.end) {
    return { success: false, error: 'Start hour must be before end hour' };
  }
  try {
    localStorage.setItem(WORK_HOURS_KEY, JSON.stringify(hours));
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Could not save settings';
    return { success: false, error: message };
  }
}
