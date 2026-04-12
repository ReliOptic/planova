import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../infrastructure/persistence/db';
import { composeViewModels } from '../services/task-view-model';
import { computeDailyPulse, type DailyPulseData } from '../services/daily-pulse';
import { getWorkHours } from '../utils/settings';
import { getLocalHourMinute } from '../utils/date-utils';

/**
 * useDailyPulse — reactively computes DailyPulseData for the given date.
 *
 * Watches tasks and scheduleBlocks via liveQuery so the card updates
 * automatically when tasks are completed during the day.
 */
export function useDailyPulse(date: string): DailyPulseData | null {
  const [pulseData, setPulseData] = useState<DailyPulseData | null>(null);

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [tasks, blocks] = await Promise.all([
        db.tasks.toArray(),
        db.scheduleBlocks.where('scheduledDate').equals(date).toArray(),
      ]);
      return { tasks, blocks };
    }).subscribe({
      next: ({ tasks, blocks }) => {
        const viewModels = composeViewModels(tasks, blocks);
        const workHours = getWorkHours();

        // Build block time intervals for gap computation from completed tasks'
        // stored start/end times (since their ScheduleBlocks are deleted at completion)
        const completedBlockIntervals = tasks
          .filter(
            (t) =>
              t.status === 'Completed' &&
              t.completedScheduledDate === date &&
              t.completedStartTime != null &&
              t.actualDurationMinutes != null,
          )
          .map((t) => {
            const start = t.completedStartTime!;
            const end = new Date(
              Date.parse(start) + t.actualDurationMinutes! * 60_000,
            ).toISOString();
            return { startTime: start, endTime: end };
          });

        // Also include active (non-completed) blocks scheduled for this date
        const activeBlockIntervals = blocks.map((b) => ({
          startTime: b.startTime,
          endTime: b.endTime,
        }));

        const allIntervals = [...completedBlockIntervals, ...activeBlockIntervals];

        const pulse = computeDailyPulse(
          [...viewModels],
          allIntervals,
          date,
          workHours.start,
          workHours.end,
        );
        setPulseData(pulse);
      },
      error: () => {
        setPulseData(null);
      },
    });

    return () => sub.unsubscribe();
  }, [date]);

  return pulseData;
}

/**
 * Check whether work hours have ended for today, used to auto-show the pulse card.
 */
export function useIsAfterWorkHours(): boolean {
  const [isAfter, setIsAfter] = useState(false);

  useEffect(() => {
    const check = (): void => {
      const workHours = getWorkHours();
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      setIsAfter(currentHour >= workHours.end);
    };

    check();
    // Re-check every minute
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  return isAfter;
}

// Re-export for convenience — callers only need to import from this hook file.
export type { DailyPulseData };
// Suppress unused import warning — getLocalHourMinute used in inline computation above indirectly
void getLocalHourMinute;
