import { describe, it, expect } from 'vitest';
import { composeViewModels } from '../../../src/services/task-view-model';
import type { Task } from '../../../src/domain/task';
import type { ScheduleBlock } from '../../../src/domain/schedule-block';

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: `Task ${id}`,
  durationMinutes: 60,
  priority: 'Medium',
  status: 'Pending',
  createdAt: 1_712_000_000_000,
  schemaVersion: 2,
  ...overrides,
});

const block = (
  id: string,
  taskId: string,
  overrides: Partial<ScheduleBlock> = {},
): ScheduleBlock => ({
  id,
  taskId,
  scheduledDate: '2026-04-13',
  startTime: '2026-04-13T09:00:00.000Z',
  endTime: '2026-04-13T10:00:00.000Z',
  schemaVersion: 2,
  ...overrides,
});

describe('composeViewModels()', () => {
  it('returns tasks with duration alias and no schedule fields when unblocked', () => {
    const result = composeViewModels([task('a', { durationMinutes: 45 })], []);

    expect(result).toHaveLength(1);
    const vm = result[0];
    expect(vm.id).toBe('a');
    expect(vm.duration).toBe(45);
    expect(vm.scheduledDate).toBeUndefined();
    expect(vm.startTime).toBeUndefined();
    expect(vm.endTime).toBeUndefined();
    expect(vm.scheduleBlockId).toBeUndefined();
    expect(vm.blockDurationMinutes).toBeUndefined();
  });

  it('joins a Task with its ScheduleBlock and derives blockDurationMinutes from end - start', () => {
    const t = task('a', { durationMinutes: 60 });
    const b = block('blk-1', 'a', {
      startTime: '2026-04-13T09:00:00.000Z',
      endTime: '2026-04-13T10:30:00.000Z',
    });

    const [vm] = composeViewModels([t], [b]);

    expect(vm.scheduleBlockId).toBe('blk-1');
    expect(vm.startTime).toBe('2026-04-13T09:00:00.000Z');
    expect(vm.endTime).toBe('2026-04-13T10:30:00.000Z');
    expect(vm.scheduledDate).toBe('2026-04-13');
    expect(vm.blockDurationMinutes).toBe(90);
  });

  it('allows blockDurationMinutes to diverge from Task.durationMinutes (planned vs actual)', () => {
    const t = task('a', { durationMinutes: 60 });
    const b = block('blk-1', 'a', {
      startTime: '2026-04-13T09:00:00.000Z',
      endTime: '2026-04-13T09:45:00.000Z', // block shrunk to 45m
    });

    const [vm] = composeViewModels([t], [b]);

    expect(vm.durationMinutes).toBe(60);
    expect(vm.duration).toBe(60);
    expect(vm.blockDurationMinutes).toBe(45);
  });

  it('uses the first matching block when multiple blocks reference the same task', () => {
    const t = task('a');
    const b1 = block('blk-1', 'a', { startTime: '2026-04-13T09:00:00.000Z', endTime: '2026-04-13T10:00:00.000Z' });
    const b2 = block('blk-2', 'a', { startTime: '2026-04-13T14:00:00.000Z', endTime: '2026-04-13T15:00:00.000Z' });

    const [vm] = composeViewModels([t], [b1, b2]);

    expect(vm.scheduleBlockId).toBe('blk-1');
  });

  it('handles blocks that reference a missing task by ignoring them', () => {
    const t = task('a');
    const orphan = block('blk-x', 'missing');

    const result = composeViewModels([t], [orphan]);

    expect(result).toHaveLength(1);
    expect(result[0].scheduleBlockId).toBeUndefined();
  });

  it('returns an empty array for an empty task list', () => {
    expect(composeViewModels([], [block('blk-1', 'a')])).toEqual([]);
  });

  it('rounds fractional minutes to the nearest whole minute', () => {
    const t = task('a');
    const b = block('blk-1', 'a', {
      startTime: '2026-04-13T09:00:00.000Z',
      endTime: '2026-04-13T09:00:30.000Z', // 0.5 min → rounds to 1
    });

    const [vm] = composeViewModels([t], [b]);

    expect(vm.blockDurationMinutes).toBe(1);
  });
});
