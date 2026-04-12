import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ok } from '../../../src/domain/result';

// Mock the dependencies module before importing the SUT so the hook picks up
// the stubs instead of hitting IndexedDB.
const taskUpdate = vi.fn();
const blockUpdate = vi.fn();
const blockCreate = vi.fn();
const blockGetByTaskId = vi.fn();
const blockDelete = vi.fn();
const logInfo = vi.fn();
const logError = vi.fn();

vi.mock('../../../src/app/dependencies', () => ({
  taskRepository: {
    update: (...args: unknown[]) => taskUpdate(...args),
  },
  scheduleBlockRepository: {
    update: (...args: unknown[]) => blockUpdate(...args),
    create: (...args: unknown[]) => blockCreate(...args),
    getByTaskId: (...args: unknown[]) => blockGetByTaskId(...args),
    delete: (...args: unknown[]) => blockDelete(...args),
  },
  logger: {
    info: (...args: unknown[]) => logInfo(...args),
    error: (...args: unknown[]) => logError(...args),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import AFTER vi.mock so the mocked module is wired into the hook.
import { handleResizeTask } from '../../../src/hooks/use-task-schedule';
import type { TaskViewModel } from '../../../src/services/task-view-model';

const scheduledTask = (overrides: Partial<TaskViewModel> = {}): TaskViewModel => ({
  id: 'task-1',
  title: 'Focus session',
  durationMinutes: 60,
  duration: 60,
  priority: 'Medium',
  status: 'Scheduled',
  createdAt: 1_712_000_000_000,
  schemaVersion: 2,
  scheduleBlockId: 'blk-1',
  scheduledDate: '2026-04-13',
  startTime: '2026-04-13T09:00:00.000Z',
  endTime: '2026-04-13T10:00:00.000Z',
  blockDurationMinutes: 60,
  ...overrides,
});

describe('handleResizeTask — regression guard: decoupled from Task.durationMinutes', () => {
  const showToast = vi.fn();

  beforeEach(() => {
    taskUpdate.mockReset();
    blockUpdate.mockReset();
    blockUpdate.mockResolvedValue(ok({}));
    showToast.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resizing the bottom edge updates ONLY the ScheduleBlock endTime', async () => {
    const task = scheduledTask();

    // deltaSlots = 2 → +30 min
    await handleResizeTask('task-1', 'bottom', 2, [task], showToast);

    expect(taskUpdate).not.toHaveBeenCalled();
    expect(blockUpdate).toHaveBeenCalledTimes(1);
    const [blockId, patch] = blockUpdate.mock.calls[0];
    expect(blockId).toBe('blk-1');
    expect(patch).toHaveProperty('endTime');
    expect(patch).not.toHaveProperty('startTime');
    expect(patch).not.toHaveProperty('durationMinutes');
  });

  it('resizing the top edge updates ONLY the ScheduleBlock startTime', async () => {
    const task = scheduledTask();

    // deltaSlots = -2 → -30 min (pull top up by 30 min → start earlier)
    await handleResizeTask('task-1', 'top', -2, [task], showToast);

    expect(taskUpdate).not.toHaveBeenCalled();
    expect(blockUpdate).toHaveBeenCalledTimes(1);
    const [blockId, patch] = blockUpdate.mock.calls[0];
    expect(blockId).toBe('blk-1');
    expect(patch).toHaveProperty('startTime');
    expect(patch).not.toHaveProperty('endTime');
    expect(patch).not.toHaveProperty('durationMinutes');
  });

  it('refuses to shrink below 15 minutes and writes nothing', async () => {
    const task = scheduledTask({
      durationMinutes: 15,
      duration: 15,
      blockDurationMinutes: 15,
      endTime: '2026-04-13T09:15:00.000Z',
    });

    // Shrink by another 15 min from the top → would leave 0 → aborted.
    await handleResizeTask('task-1', 'top', 1, [task], showToast);

    expect(taskUpdate).not.toHaveBeenCalled();
    expect(blockUpdate).not.toHaveBeenCalled();
  });

  it('prefers blockDurationMinutes over durationMinutes when deciding the new length', async () => {
    // Planned 60m, but the block has been dragged down to 30m earlier.
    // Extending the bottom by +15m should yield 45m, not 75m.
    const task = scheduledTask({
      durationMinutes: 60,
      duration: 60,
      blockDurationMinutes: 30,
      endTime: '2026-04-13T09:30:00.000Z',
    });

    await handleResizeTask('task-1', 'bottom', 1, [task], showToast);

    expect(blockUpdate).toHaveBeenCalledTimes(1);
    const [, patch] = blockUpdate.mock.calls[0];
    // Expected new end = start (09:00) + 45m = 09:45 UTC
    expect(patch.endTime).toBe('2026-04-13T09:45:00.000Z');
  });
});
