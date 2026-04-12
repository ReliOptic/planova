import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../infrastructure/persistence/db';
import { computeWeeklyTrend, type WeeklyTrendData } from '../services/weekly-trend';

/**
 * useWeeklyTrend — reactively computes weekly planning accuracy.
 *
 * @param selectedDate YYYY-MM-DD — treated as the last day of the 7-day window.
 */
export function useWeeklyTrend(selectedDate: string): {
  data: WeeklyTrendData | null;
  loading: boolean;
} {
  const [data, setData] = useState<WeeklyTrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const subscription = liveQuery(() =>
      db.tasks.where('status').equals('Completed').toArray(),
    ).subscribe({
      next: (tasks) => {
        const trend = computeWeeklyTrend(tasks, selectedDate);
        setData(trend);
        setLoading(false);
      },
      error: (cause: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'weekly-trend/load-failed',
            cause: String(cause),
          }),
        );
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [selectedDate]);

  return { data, loading };
}
