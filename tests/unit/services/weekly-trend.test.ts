import { describe, it, expect } from 'vitest';
import { computeWeeklyTrend } from '../../../src/services/weekly-trend';
import type { Task } from '../../../src/domain/task';

/** Minimal completed Task factory. */
function makeTask(overrides: Partial<Task> & { id: string }): Task {
  const base: Task = {
    id: overrides.id,
    title: 'Test Task',
    durationMinutes: 60,
    priority: 'Medium',
    status: 'Completed',
    createdAt: 1700000000000,
    completedAt: 1700000000000,
    schemaVersion: 2,
  };
  return { ...base, ...overrides };
}

const END_DATE = '2026-04-13'; // Monday (index 1 in Korean week)
const START_DATE = '2026-04-07'; // Tuesday of previous week

describe('computeWeeklyTrend()', () => {
  describe('empty data', () => {
    it('returns 7 days all with accuracy null', () => {
      const result = computeWeeklyTrend([], END_DATE);
      expect(result.days).toHaveLength(7);
      result.days.forEach((d) => {
        expect(d.accuracy).toBeNull();
        expect(d.completedCount).toBe(0);
      });
    });

    it('returns weekAverage of 0 when no data', () => {
      const result = computeWeeklyTrend([], END_DATE);
      expect(result.weekAverage).toBe(0);
    });
  });

  describe('tasks without actualDurationMinutes', () => {
    it('ignores tasks missing actualDurationMinutes', () => {
      const task = makeTask({ id: 't1', completedScheduledDate: END_DATE });
      // no actualDurationMinutes set
      const result = computeWeeklyTrend([task], END_DATE);
      const today = result.days.find((d) => d.date === END_DATE);
      expect(today?.accuracy).toBeNull();
      expect(today?.completedCount).toBe(0);
    });
  });

  describe('1 day with data', () => {
    it('computes perfect accuracy for exact duration match', () => {
      const task = makeTask({
        id: 't1',
        durationMinutes: 60,
        actualDurationMinutes: 60,
        completedScheduledDate: END_DATE,
      });
      const result = computeWeeklyTrend([task], END_DATE);
      const today = result.days.find((d) => d.date === END_DATE);
      expect(today?.accuracy).toBe(100);
      expect(today?.completedCount).toBe(1);
      expect(result.weekAverage).toBe(100);
    });

    it('computes 50% accuracy when deviation equals planned duration', () => {
      // planned=60, actual=120 → deviation=60 → accuracy = max(0, 1 - 60/60)*100 = 0%
      // planned=60, actual=90 → deviation=30 → accuracy = max(0, 1 - 30/60)*100 = 50%
      const task = makeTask({
        id: 't1',
        durationMinutes: 60,
        actualDurationMinutes: 90,
        completedScheduledDate: END_DATE,
      });
      const result = computeWeeklyTrend([task], END_DATE);
      const today = result.days.find((d) => d.date === END_DATE);
      expect(today?.accuracy).toBeCloseTo(50, 1);
    });

    it('clamps accuracy to 0 when deviation exceeds planned', () => {
      const task = makeTask({
        id: 't1',
        durationMinutes: 60,
        actualDurationMinutes: 180, // deviation=120, > planned=60
        completedScheduledDate: END_DATE,
      });
      const result = computeWeeklyTrend([task], END_DATE);
      const today = result.days.find((d) => d.date === END_DATE);
      expect(today?.accuracy).toBe(0);
    });
  });

  describe('3 days with data', () => {
    it('only counts days in the 7-day window', () => {
      const tasks: Task[] = [
        makeTask({ id: 't1', durationMinutes: 60, actualDurationMinutes: 60, completedScheduledDate: END_DATE }),
        makeTask({ id: 't2', durationMinutes: 60, actualDurationMinutes: 60, completedScheduledDate: START_DATE }),
        makeTask({ id: 't3', durationMinutes: 60, actualDurationMinutes: 60, completedScheduledDate: '2026-04-09' }),
      ];
      const result = computeWeeklyTrend(tasks, END_DATE);
      const daysWithData = result.days.filter((d) => d.accuracy !== null);
      expect(daysWithData).toHaveLength(3);
    });

    it('computes correct weekAverage across 3 days', () => {
      const tasks: Task[] = [
        makeTask({ id: 't1', durationMinutes: 60, actualDurationMinutes: 60, completedScheduledDate: END_DATE }), // 100%
        makeTask({ id: 't2', durationMinutes: 60, actualDurationMinutes: 90, completedScheduledDate: START_DATE }), // 50%
        makeTask({ id: 't3', durationMinutes: 60, actualDurationMinutes: 60, completedScheduledDate: '2026-04-09' }), // 100%
      ];
      const result = computeWeeklyTrend(tasks, END_DATE);
      // average = (100+50+100)/3 = 83.33 → rounded 83
      expect(result.weekAverage).toBe(83);
    });
  });

  describe('7 days with data', () => {
    it('returns 7 non-null days when all days have tasks', () => {
      const tasks: Task[] = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(Date.UTC(2026, 3, 7 + i)).toISOString().slice(0, 10);
        return makeTask({
          id: `t${i}`,
          durationMinutes: 60,
          actualDurationMinutes: 60,
          completedScheduledDate: date,
        });
      });
      const result = computeWeeklyTrend(tasks, END_DATE);
      expect(result.days).toHaveLength(7);
      result.days.forEach((d) => expect(d.accuracy).toBe(100));
      expect(result.weekAverage).toBe(100);
    });
  });

  describe('days with 0 completions', () => {
    it('marks days outside window as null', () => {
      const task = makeTask({
        id: 't1',
        durationMinutes: 60,
        actualDurationMinutes: 60,
        completedScheduledDate: '2026-04-01', // before window
      });
      const result = computeWeeklyTrend([task], END_DATE);
      result.days.forEach((d) => expect(d.accuracy).toBeNull());
    });
  });

  describe('perfect accuracy', () => {
    it('100% when actual equals planned across multiple tasks same day', () => {
      const tasks: Task[] = [
        makeTask({ id: 't1', durationMinutes: 30, actualDurationMinutes: 30, completedScheduledDate: END_DATE }),
        makeTask({ id: 't2', durationMinutes: 90, actualDurationMinutes: 90, completedScheduledDate: END_DATE }),
      ];
      const result = computeWeeklyTrend(tasks, END_DATE);
      const today = result.days.find((d) => d.date === END_DATE);
      expect(today?.accuracy).toBe(100);
      expect(today?.completedCount).toBe(2);
    });
  });

  describe('all overdue (actual > planned)', () => {
    it('computes weighted accuracy across tasks on same day', () => {
      // planned=60+60=120, actual=90+90=180, deviation=60
      // accuracy = max(0, 1 - 60/120)*100 = 50%
      const tasks: Task[] = [
        makeTask({ id: 't1', durationMinutes: 60, actualDurationMinutes: 90, completedScheduledDate: END_DATE }),
        makeTask({ id: 't2', durationMinutes: 60, actualDurationMinutes: 90, completedScheduledDate: END_DATE }),
      ];
      const result = computeWeeklyTrend(tasks, END_DATE);
      const today = result.days.find((d) => d.date === END_DATE);
      expect(today?.accuracy).toBeCloseTo(50, 1);
    });

    it('falls back to completedAt when completedScheduledDate is absent', () => {
      // completedAt for 2026-04-13 UTC
      const completedAt = Date.UTC(2026, 3, 13, 10, 0, 0);
      const task = makeTask({
        id: 't1',
        durationMinutes: 60,
        actualDurationMinutes: 60,
        completedAt,
      });
      const result = computeWeeklyTrend([task], END_DATE);
      const today = result.days.find((d) => d.date === END_DATE);
      expect(today?.accuracy).toBe(100);
    });
  });

  describe('day labels', () => {
    it('assigns correct Korean day labels', () => {
      // 2026-04-07 is a Tuesday (화), ..., 2026-04-13 is a Monday (월)
      const result = computeWeeklyTrend([], END_DATE);
      expect(result.days[0].date).toBe('2026-04-07');
      expect(result.days[0].dayLabel).toBe('화');
      expect(result.days[6].date).toBe('2026-04-13');
      expect(result.days[6].dayLabel).toBe('월');
    });
  });
});
