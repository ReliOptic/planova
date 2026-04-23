import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ok } from '../../../src/domain/result';

// Mock the dependencies module before importing the SUT.
const taskUpdate = vi.fn();
const blockUpdate = vi.fn();
const logInfo = vi.fn();
const logError = vi.fn();

vi.mock('../../../src/app/dependencies', () => ({
  taskRepository: {
    update: (...args: unknown[]) => taskUpdate(...args),
  },
  scheduleBlockRepository: {
    update: (...args: unknown[]) => blockUpdate(...args),
    create: vi.fn(),
    getByTaskId: vi.fn(),
    delete: vi.fn(),
  },
  logger: {
    info: (...args: unknown[]) => logInfo(...args),
    error: (...args: unknown[]) => logError(...args),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { handleSaveTask } from '../../../src/hooks/use-task-crud';
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
  // 10:00 KST = 01:00 UTC. This is the tricky case that exposed the timezone bug.
  startTime: '2026-04-13T01:00:00.000Z',
  endTime: '2026-04-13T02:00:00.000Z',
  blockDurationMinutes: 60,
  ...overrides,
});

describe('handleSaveTask — duration edit recomputes block endTime correctly across timezones', () => {
  const showToast = vi.fn();
  const setIsModalOpen = vi.fn();
  const setEditingTask = vi.fn();

  beforeEach(() => {
    taskUpdate.mockReset();
    taskUpdate.mockResolvedValue(ok({}));
    blockUpdate.mockReset();
    blockUpdate.mockResolvedValue(ok({}));
    showToast.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('editing duration to 120min extends endTime by exactly 120min from startTime', async () => {
    const task = scheduledTask();

    await handleSaveTask(
      { id: 'task-1', duration: 120 },
      [task],
      showToast,
      setIsModalOpen,
      setEditingTask,
    );

    expect(blockUpdate).toHaveBeenCalledTimes(1);
    const [blockId, patch] = blockUpdate.mock.calls[0];
    expect(blockId).toBe('blk-1');
    // startTime + 120min = 01:00 UTC + 2h = 03:00 UTC
    expect(patch.endTime).toBe('2026-04-13T03:00:00.000Z');
  });

  it('endTime is always strictly after startTime (regression guard for tiny red block)', async () => {
    const task = scheduledTask();

    await handleSaveTask(
      { id: 'task-1', duration: 120 },
      [task],
      showToast,
      setIsModalOpen,
      setEditingTask,
    );

    const [, patch] = blockUpdate.mock.calls[0];
    expect(Date.parse(patch.endTime)).toBeGreaterThan(Date.parse(task.startTime!));
  });

  it('does not touch the block when duration is unchanged', async () => {
    const task = scheduledTask();

    await handleSaveTask(
      { id: 'task-1', duration: 60 },
      [task],
      showToast,
      setIsModalOpen,
      setEditingTask,
    );

    expect(blockUpdate).not.toHaveBeenCalled();
  });
});
