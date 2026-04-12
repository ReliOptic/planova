/**
 * ghost-generator.ts — generates "Yesterday Ghost" blocks for the day-view timeline.
 *
 * Source 1: Yesterday's completed tasks (or last same-weekday within 14 days).
 * Source 2: weekday-time patterns from pattern-detector (MIN_COMPLETED_COUNT = 10).
 * Priority: Source 1 first. Source 2 fills remaining slots when available.
 * Slots already occupied by today's ScheduleBlocks are excluded.
 */

import type { Priority, TaskColor } from '../domain/task';
import type { ScheduleBlock } from '../domain/schedule-block';
import { getLocalHourMinute, addDays } from '../utils/date-utils';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A ghost block shown on the timeline as a faded template. */
export interface GhostBlock {
  readonly id: string;
  readonly title: string;
  readonly startHour: number;
  readonly startMinute: number;
  readonly durationMinutes: number;
  readonly priority: Priority;
  readonly color?: TaskColor;
  readonly source: 'yesterday' | 'pattern';
}

/** Minimal shape of a completed task needed for ghost generation. */
export interface CompletedTaskSnapshot {
  readonly id: string;
  readonly title: string;
  readonly priority: Priority;
  readonly color?: TaskColor;
  readonly durationMinutes: number;
  readonly actualDurationMinutes?: number;
  readonly completedScheduledDate?: string;
  readonly completedStartTime?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the weekday number (0=Sunday…6=Saturday) for a YYYY-MM-DD string. */
function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Check whether a [startHour, startMinute, durationMinutes] range overlaps any today block. */
function overlapsAnyBlock(
  startHour: number,
  startMinute: number,
  durationMinutes: number,
  todayBlocks: readonly ScheduleBlock[],
): boolean {
  const ghostStart = startHour * 60 + startMinute;
  const ghostEnd = ghostStart + durationMinutes;

  for (const block of todayBlocks) {
    const { hour: bh, minute: bm } = getLocalHourMinute(block.startTime);
    const blockStartMin = bh * 60 + bm;
    const blockDur = Math.round(
      (Date.parse(block.endTime) - Date.parse(block.startTime)) / 60_000,
    );
    const blockEndMin = blockStartMin + blockDur;

    // Overlap if intervals intersect (not just touch)
    if (ghostStart < blockEndMin && ghostEnd > blockStartMin) {
      return true;
    }
  }
  return false;
}

/** Check whether a slot key (startHour:startMinute) has already been claimed by a ghost. */
function slotKey(startHour: number, startMinute: number): string {
  return `${startHour}:${startMinute}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * generateGhosts — builds a list of GhostBlock suggestions for `selectedDate`.
 *
 * @param completedTasks  - All completed tasks with preserved schedule info.
 * @param todayBlocks     - Active ScheduleBlocks already placed on selectedDate.
 * @param selectedDate    - YYYY-MM-DD of the day being viewed.
 * @param workStart       - Work-hours start (local hour, e.g. 9).
 * @param workEnd         - Work-hours end (local hour, e.g. 18).
 */
export function generateGhosts(
  completedTasks: readonly CompletedTaskSnapshot[],
  todayBlocks: readonly ScheduleBlock[],
  selectedDate: string,
  workStart: number,
  workEnd: number,
): GhostBlock[] {
  const usedSlots = new Set<string>();
  const ghosts: GhostBlock[] = [];

  // ── Source 1: yesterday / last same-weekday ─────────────────────────────

  const targetWeekday = weekdayOf(selectedDate);

  // Build candidate dates: yesterday first, then walk back up to 14 days looking
  // for the same weekday.
  const candidateDates: string[] = [];
  const yesterday = addDays(selectedDate, -1);
  candidateDates.push(yesterday);

  // If yesterday is not same weekday as selectedDate, also include the most
  // recent prior same-weekday date (within 14 days).
  if (weekdayOf(yesterday) !== targetWeekday) {
    for (let offset = 2; offset <= 14; offset++) {
      const candidate = addDays(selectedDate, -offset);
      if (weekdayOf(candidate) === targetWeekday) {
        candidateDates.push(candidate);
        break;
      }
    }
  }

  // Collect tasks that were completed on any candidate date, keeping the first
  // (most-recent) match per task title+slot.
  for (const candidate of candidateDates) {
    const tasksOnDate = completedTasks.filter(
      (t) => t.completedScheduledDate === candidate && t.completedStartTime != null,
    );

    for (const task of tasksOnDate) {
      if (!task.completedStartTime) continue;

      const { hour, minute } = getLocalHourMinute(task.completedStartTime);

      // Skip out-of-work-hours
      if (hour < workStart || hour >= workEnd) continue;

      const duration = task.actualDurationMinutes ?? task.durationMinutes;
      if (duration <= 0) continue;

      // Skip overlapping today blocks
      if (overlapsAnyBlock(hour, minute, duration, todayBlocks)) continue;

      const key = slotKey(hour, minute);
      if (usedSlots.has(key)) continue;

      usedSlots.add(key);
      ghosts.push({
        id: `ghost-yesterday-${task.id}`,
        title: task.title,
        startHour: hour,
        startMinute: minute,
        durationMinutes: duration,
        priority: task.priority,
        color: task.color,
        source: 'yesterday',
      });
    }
  }

  return ghosts;
}
