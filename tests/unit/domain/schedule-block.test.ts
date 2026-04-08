import { describe, it, expect } from 'vitest';
import { createScheduleBlock, type CreateScheduleBlockInput } from '../../../src/domain/schedule-block';

const baseInput: CreateScheduleBlockInput = {
  id: 'block-1',
  taskId: 'task-1',
  scheduledDate: '2026-04-08',
  startTime: '2026-04-08T09:00:00.000Z',
  endTime: '2026-04-08T10:00:00.000Z',
};

describe('createScheduleBlock()', () => {
  describe('valid input', () => {
    it('returns ok with a well-formed ScheduleBlock', () => {
      const result = createScheduleBlock(baseInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('block-1');
        expect(result.value.taskId).toBe('task-1');
        expect(result.value.scheduledDate).toBe('2026-04-08');
        expect(result.value.startTime).toBe('2026-04-08T09:00:00.000Z');
        expect(result.value.endTime).toBe('2026-04-08T10:00:00.000Z');
        expect(result.value.schemaVersion).toBe(2);
      }
    });
  });

  describe('invalid id', () => {
    it('returns err for empty id', () => {
      const result = createScheduleBlock({ ...baseInput, id: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('id');
        }
      }
    });
  });

  describe('invalid taskId', () => {
    it('returns err for empty taskId', () => {
      const result = createScheduleBlock({ ...baseInput, taskId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('taskId');
        }
      }
    });
  });

  describe('invalid scheduledDate', () => {
    it('returns err for non-YYYY-MM-DD format', () => {
      const result = createScheduleBlock({ ...baseInput, scheduledDate: 'April 8 2026' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('scheduledDate');
        }
      }
    });

    it('returns err for empty scheduledDate', () => {
      const result = createScheduleBlock({ ...baseInput, scheduledDate: '' });
      expect(result.ok).toBe(false);
    });
  });

  describe('invalid startTime', () => {
    it('returns err for non-ISO startTime', () => {
      const result = createScheduleBlock({ ...baseInput, startTime: 'not-a-date' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('startTime');
        }
      }
    });
  });

  describe('invalid endTime', () => {
    it('returns err for non-ISO endTime', () => {
      const result = createScheduleBlock({ ...baseInput, endTime: 'not-a-date' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('endTime');
        }
      }
    });

    it('returns err when endTime is not after startTime', () => {
      const result = createScheduleBlock({
        ...baseInput,
        endTime: '2026-04-08T08:00:00.000Z', // before startTime
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('endTime');
        }
      }
    });

    it('returns err when endTime equals startTime', () => {
      const result = createScheduleBlock({
        ...baseInput,
        endTime: baseInput.startTime,
      });
      expect(result.ok).toBe(false);
    });
  });
});
