import { describe, it, expect } from 'vitest';
import { isBackupBundle } from '../../../src/domain/backup-bundle';

const validTask = {
  id: 'task-1',
  title: 'Test',
  durationMinutes: 30,
  priority: 'Medium',
  status: 'Pending',
  createdAt: 1000,
  schemaVersion: 2 as const,
};

const validBlock = {
  id: 'block-1',
  taskId: 'task-1',
  scheduledDate: '2026-04-08',
  startTime: '2026-04-08T09:00:00.000Z',
  endTime: '2026-04-08T10:00:00.000Z',
  schemaVersion: 2 as const,
};

const validBundle = {
  format: 'planova-backup' as const,
  version: 1 as const,
  exportedAt: 1744000000000,
  schemaVersion: 2 as const,
  tasks: [validTask],
  scheduleBlocks: [validBlock],
};

describe('isBackupBundle()', () => {
  it('returns true for a valid bundle', () => {
    expect(isBackupBundle(validBundle)).toBe(true);
  });

  it('returns true for a bundle with empty arrays', () => {
    expect(isBackupBundle({ ...validBundle, tasks: [], scheduleBlocks: [] })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isBackupBundle(null)).toBe(false);
  });

  it('returns false for a non-object', () => {
    expect(isBackupBundle('string')).toBe(false);
    expect(isBackupBundle(42)).toBe(false);
  });

  it('returns false when format is wrong', () => {
    expect(isBackupBundle({ ...validBundle, format: 'other-app-backup' })).toBe(false);
  });

  it('returns false when version is wrong', () => {
    expect(isBackupBundle({ ...validBundle, version: 2 })).toBe(false);
  });

  it('returns false when exportedAt is not a number', () => {
    expect(isBackupBundle({ ...validBundle, exportedAt: '2026-04-08' })).toBe(false);
  });

  it('returns false when schemaVersion is wrong', () => {
    expect(isBackupBundle({ ...validBundle, schemaVersion: 1 })).toBe(false);
  });

  it('returns false when tasks is missing', () => {
    const { tasks: _tasks, ...rest } = validBundle;
    expect(isBackupBundle(rest)).toBe(false);
  });

  it('returns false when tasks is not an array', () => {
    expect(isBackupBundle({ ...validBundle, tasks: 'not-an-array' })).toBe(false);
  });

  it('returns false when scheduleBlocks is missing', () => {
    const { scheduleBlocks: _blocks, ...rest } = validBundle;
    expect(isBackupBundle(rest)).toBe(false);
  });

  it('returns false when a task has wrong shape (missing id)', () => {
    const badTask = { ...validTask, id: undefined };
    expect(isBackupBundle({ ...validBundle, tasks: [badTask] })).toBe(false);
  });

  it('returns false when a task has wrong schemaVersion', () => {
    const badTask = { ...validTask, schemaVersion: 1 };
    expect(isBackupBundle({ ...validBundle, tasks: [badTask] })).toBe(false);
  });

  it('returns false when a task is missing durationMinutes', () => {
    const { durationMinutes: _d, ...badTask } = validTask;
    expect(isBackupBundle({ ...validBundle, tasks: [badTask] })).toBe(false);
  });

  it('returns false when a scheduleBlock has wrong shape', () => {
    const badBlock = { ...validBlock, taskId: 123 };
    expect(isBackupBundle({ ...validBundle, scheduleBlocks: [badBlock] })).toBe(false);
  });
});
