import { describe, it, expect } from 'vitest';
import {
  validateRecurrenceRule,
  getNextOccurrence,
  type RecurrenceRule,
} from '../../../src/domain/recurrence-rule';

describe('validateRecurrenceRule', () => {
  it('accepts a valid daily rule', () => {
    expect(validateRecurrenceRule({ frequency: 'daily', interval: 1 })).toBeNull();
  });

  it('accepts a valid weekly rule with daysOfWeek', () => {
    expect(
      validateRecurrenceRule({ frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] }),
    ).toBeNull();
  });

  it('accepts a valid monthly rule with endDate', () => {
    expect(
      validateRecurrenceRule({ frequency: 'monthly', interval: 2, endDate: '2026-12-31' }),
    ).toBeNull();
  });

  it('rejects invalid frequency', () => {
    expect(validateRecurrenceRule({ frequency: 'yearly' as any, interval: 1 })).not.toBeNull();
  });

  it('rejects interval < 1', () => {
    expect(validateRecurrenceRule({ frequency: 'daily', interval: 0 })).not.toBeNull();
  });

  it('rejects non-integer interval', () => {
    expect(validateRecurrenceRule({ frequency: 'daily', interval: 1.5 })).not.toBeNull();
  });

  it('rejects empty daysOfWeek array', () => {
    expect(
      validateRecurrenceRule({ frequency: 'weekly', interval: 1, daysOfWeek: [] }),
    ).not.toBeNull();
  });

  it('rejects daysOfWeek value out of range', () => {
    expect(
      validateRecurrenceRule({ frequency: 'weekly', interval: 1, daysOfWeek: [7] }),
    ).not.toBeNull();
  });

  it('rejects malformed endDate', () => {
    expect(
      validateRecurrenceRule({ frequency: 'daily', interval: 1, endDate: 'not-a-date' }),
    ).not.toBeNull();
  });
});

describe('getNextOccurrence', () => {
  describe('daily', () => {
    it('returns next day for interval=1', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
      expect(getNextOccurrence(rule, '2026-04-12')).toBe('2026-04-13');
    });

    it('returns 3 days later for interval=3', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 3 };
      expect(getNextOccurrence(rule, '2026-04-12')).toBe('2026-04-15');
    });

    it('crosses month boundary', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
      expect(getNextOccurrence(rule, '2026-04-30')).toBe('2026-05-01');
    });
  });

  describe('weekly', () => {
    it('returns 7 days later when no daysOfWeek specified', () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 };
      expect(getNextOccurrence(rule, '2026-04-12')).toBe('2026-04-19');
    });

    it('returns 14 days later for interval=2', () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 2 };
      expect(getNextOccurrence(rule, '2026-04-12')).toBe('2026-04-26');
    });

    it('returns next matching weekday in same week', () => {
      // 2026-04-13 is Monday (day 1)
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] };
      // From Monday, next should be Wednesday (day 3)
      expect(getNextOccurrence(rule, '2026-04-13')).toBe('2026-04-15');
    });

    it('wraps to next week when no more days this week', () => {
      // 2026-04-17 is Friday (day 5)
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] };
      // From Friday, next should be Monday next week
      expect(getNextOccurrence(rule, '2026-04-17')).toBe('2026-04-20');
    });
  });

  describe('monthly', () => {
    it('returns same day next month for interval=1', () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 };
      expect(getNextOccurrence(rule, '2026-04-12')).toBe('2026-05-12');
    });

    it('returns 3 months later for interval=3', () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 3 };
      expect(getNextOccurrence(rule, '2026-04-12')).toBe('2026-07-12');
    });

    it('crosses year boundary', () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 };
      expect(getNextOccurrence(rule, '2026-12-15')).toBe('2027-01-15');
    });
  });

  describe('endDate', () => {
    it('returns null when next occurrence is past endDate', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1, endDate: '2026-04-12' };
      expect(getNextOccurrence(rule, '2026-04-12')).toBeNull();
    });

    it('returns date when next occurrence is on endDate', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1, endDate: '2026-04-13' };
      expect(getNextOccurrence(rule, '2026-04-12')).toBe('2026-04-13');
    });
  });
});
