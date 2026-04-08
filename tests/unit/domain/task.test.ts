import { describe, it, expect } from 'vitest';
import { createTask, type CreateTaskInput } from '../../../src/domain/task';

const baseInput: CreateTaskInput = {
  id: 'task-1',
  title: 'Write unit tests',
  durationMinutes: 30,
  priority: 'Medium',
  status: 'Pending',
  createdAt: 1700000000000,
};

describe('createTask()', () => {
  describe('valid input', () => {
    it('returns ok with a well-formed Task', () => {
      const result = createTask(baseInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('task-1');
        expect(result.value.title).toBe('Write unit tests');
        expect(result.value.durationMinutes).toBe(30);
        expect(result.value.priority).toBe('Medium');
        expect(result.value.status).toBe('Pending');
        expect(result.value.schemaVersion).toBe(2);
      }
    });

    it('trims whitespace from title', () => {
      const result = createTask({ ...baseInput, title: '  My Task  ' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe('My Task');
      }
    });

    it('includes optional description when provided', () => {
      const result = createTask({ ...baseInput, description: 'Some details' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.description).toBe('Some details');
      }
    });

    it('includes optional due date when provided', () => {
      const result = createTask({ ...baseInput, due: '2026-04-10' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.due).toBe('2026-04-10');
      }
    });

    it('accepts all valid priorities', () => {
      for (const priority of ['High', 'Medium', 'Low'] as const) {
        const result = createTask({ ...baseInput, priority });
        expect(result.ok).toBe(true);
      }
    });

    it('accepts all valid statuses', () => {
      for (const status of ['Pending', 'Scheduled', 'In Progress', 'Completed'] as const) {
        const result = createTask({ ...baseInput, status });
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('empty title', () => {
    it('returns err for empty string', () => {
      const result = createTask({ ...baseInput, title: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('title');
        }
      }
    });

    it('returns err for whitespace-only title', () => {
      const result = createTask({ ...baseInput, title: '   ' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
      }
    });
  });

  describe('zero or negative durationMinutes', () => {
    it('returns err for zero duration', () => {
      const result = createTask({ ...baseInput, durationMinutes: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('durationMinutes');
        }
      }
    });

    it('returns err for negative duration', () => {
      const result = createTask({ ...baseInput, durationMinutes: -5 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
      }
    });
  });

  describe('invalid priority', () => {
    it('returns err for unrecognized priority string', () => {
      const result = createTask({ ...baseInput, priority: 'Critical' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('priority');
        }
      }
    });
  });

  describe('invalid status', () => {
    it('returns err for unrecognized status string', () => {
      const result = createTask({ ...baseInput, status: 'Done' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('status');
        }
      }
    });
  });
});
