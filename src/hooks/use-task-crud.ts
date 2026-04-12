import type { TaskViewModel } from '../services/task-view-model';
import { createTask } from '../domain/task';
import type { Task } from '../domain/task';
import { taskRepository, scheduleBlockRepository, logger } from '../app/dependencies';
import { buildUTCTime, getLocalToday } from '../utils/date-utils';
import { sanitizeText } from '../utils/sanitize';
import { getNextOccurrence } from '../domain/recurrence-rule';

/** Emit a structured error log via the shared logger. */
export function logError(event: string, cause: unknown): void {
  const message = cause instanceof Error ? cause.message : String(cause);
  logger.error(event, message);
}

/** Delete all ScheduleBlocks associated with a task. */
export async function deleteBlocksForTask(taskId: string): Promise<void> {
  const existing = await scheduleBlockRepository.getByTaskId(taskId);
  if (existing.ok) {
    for (const block of existing.value) {
      await scheduleBlockRepository.delete(block.id);
    }
  }
}

/**
 * handleCompleteTask — marks a task Completed and removes its schedule blocks.
 */
export async function handleCompleteTask(
  taskId: string,
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const result = await taskRepository.update(taskId, {
    status: 'Completed',
    completedAt: Date.now(),
  });
  if (!result.ok) {
    logError('task-action/complete', result.error);
    showToast('Failed to complete task.');
    return;
  }
  await deleteBlocksForTask(taskId);

  // If this is a recurring task, create the next instance
  const completedTask = (await taskRepository.get(taskId));
  if (completedTask.ok && completedTask.value.recurrenceRule) {
    const rule = completedTask.value.recurrenceRule;
    const fromDate = completedTask.value.due ?? getLocalToday();
    const nextDate = getNextOccurrence(rule, fromDate);

    if (nextDate !== null) {
      const groupId = completedTask.value.recurrenceGroupId ?? completedTask.value.id;
      const nextTask = createTask({
        id: crypto.randomUUID(),
        title: completedTask.value.title,
        description: completedTask.value.description,
        durationMinutes: completedTask.value.durationMinutes,
        due: nextDate,
        priority: completedTask.value.priority,
        status: 'Pending',
        createdAt: Date.now(),
        color: completedTask.value.color,
        recurrenceRule: rule,
        recurrenceGroupId: groupId,
      });

      if (nextTask.ok) {
        await taskRepository.create(nextTask.value);
      }
    }
  }

  showToast('Task completed', 'success');
}

/**
 * handleStartTask — transitions a task to In Progress.
 */
export async function handleStartTask(
  taskId: string,
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const result = await taskRepository.update(taskId, { status: 'In Progress' });
  if (!result.ok) {
    logError('task-action/start', result.error);
    showToast('Failed to start task.');
  }
}

/** Recurrence choice type for series operations. */
export type RecurrenceChoice = 'this' | 'future' | 'all';

/**
 * handleDeleteTask — deletes task and its schedule blocks.
 * For recurring tasks, returns 'needs-recurrence-choice' so the caller can show a dialog.
 * Once a recurrenceAction is provided, performs the appropriate series operation.
 */
export async function handleDeleteTask(
  taskId: string,
  showToast: (msg: string, type?: 'error' | 'success') => void,
  recurrenceAction?: RecurrenceChoice,
): Promise<'needs-recurrence-choice' | void> {
  const taskResult = await taskRepository.get(taskId);
  if (!taskResult.ok) {
    logError('task-action/delete-get', taskResult.error);
    showToast('Failed to delete task.');
    return;
  }

  const task = taskResult.value;

  // If recurring and no action specified, signal caller to show dialog
  if (task.recurrenceGroupId && recurrenceAction === undefined) {
    return 'needs-recurrence-choice';
  }

  // Non-recurring: simple confirm
  if (!task.recurrenceGroupId) {
    if (!window.confirm('Delete this task?')) return;
    const result = await taskRepository.delete(taskId);
    if (!result.ok) {
      logError('task-action/delete', result.error);
      showToast('Failed to delete task.');
      return;
    }
    await deleteBlocksForTask(taskId);
    showToast('Task deleted', 'success');
    return;
  }

  // Recurring with action specified
  if (recurrenceAction === 'this') {
    const result = await taskRepository.delete(taskId);
    if (!result.ok) {
      logError('task-action/delete', result.error);
      showToast('Failed to delete task.');
      return;
    }
    await deleteBlocksForTask(taskId);
    showToast('작업이 삭제되었습니다', 'success');
  } else if (recurrenceAction === 'future') {
    const seriesResult = await taskRepository.listByGroupId(task.recurrenceGroupId);
    if (!seriesResult.ok) {
      logError('task-action/delete-series', seriesResult.error);
      showToast('Failed to delete tasks.');
      return;
    }
    const taskDue = task.due ?? '';
    const toDelete = seriesResult.value.filter(
      (t) => (t.due ?? '') >= taskDue && t.status !== 'Completed',
    );
    for (const t of toDelete) {
      await taskRepository.delete(t.id);
      await deleteBlocksForTask(t.id);
    }
    showToast(`${toDelete.length}개 작업이 삭제되었습니다`, 'success');
  } else if (recurrenceAction === 'all') {
    const seriesResult = await taskRepository.listByGroupId(task.recurrenceGroupId);
    if (!seriesResult.ok) {
      logError('task-action/delete-series', seriesResult.error);
      showToast('Failed to delete tasks.');
      return;
    }
    for (const t of seriesResult.value) {
      await taskRepository.delete(t.id);
      await deleteBlocksForTask(t.id);
    }
    showToast(`${seriesResult.value.length}개 작업이 삭제되었습니다`, 'success');
  }
}

/**
 * handleSaveTask — creates a new task or updates an existing one.
 * Recomputes ScheduleBlock endTime when duration changes on a scheduled task.
 * For recurring tasks, returns 'needs-recurrence-choice' so the caller can show a dialog.
 */
export async function handleSaveTask(
  taskData: Partial<TaskViewModel>,
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: TaskViewModel | null) => void,
  recurrenceAction?: RecurrenceChoice,
): Promise<'needs-recurrence-choice' | void> {
  if (taskData.id) {
    return updateExistingTask(taskData, tasks, showToast, setIsModalOpen, setEditingTask, recurrenceAction);
  }
  await createNewTask(taskData, showToast, setIsModalOpen, setEditingTask);
}

async function updateExistingTask(
  taskData: Partial<TaskViewModel>,
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: TaskViewModel | null) => void,
  recurrenceAction?: RecurrenceChoice,
): Promise<'needs-recurrence-choice' | void> {
  const existingTask = tasks.find((t) => t.id === taskData.id);

  // Check if this is a recurring task that needs a choice
  if (existingTask?.recurrenceRule && existingTask?.recurrenceGroupId && recurrenceAction === undefined) {
    return 'needs-recurrence-choice';
  }

  const patch: Parameters<typeof taskRepository.update>[1] = {
    title: taskData.title !== undefined ? sanitizeText(taskData.title) : undefined,
    durationMinutes: taskData.duration,
    due: taskData.due,
    priority: taskData.priority,
    description: taskData.description !== undefined ? sanitizeText(taskData.description) : undefined,
    color: taskData.color,
    recurrenceRule: taskData.recurrenceRule,
    recurrenceGroupId: taskData.recurrenceGroupId,
    group: taskData.group,
  };

  if (
    existingTask?.startTime &&
    existingTask?.scheduledDate &&
    existingTask?.scheduleBlockId &&
    taskData.duration !== undefined &&
    taskData.duration !== existingTask.durationMinutes
  ) {
    const startDate = new Date(existingTask.startTime);
    const endMs = startDate.getTime() + taskData.duration * 60_000;
    const newEnd = new Date(endMs);
    const endTime = buildUTCTime(
      existingTask.scheduledDate,
      newEnd.getUTCHours(),
      newEnd.getUTCMinutes(),
    );
    const blockRes = await scheduleBlockRepository.update(existingTask.scheduleBlockId, { endTime });
    if (!blockRes.ok) {
      logError('task-action/save-block', blockRes.error);
      showToast('Failed to save task.');
      return;
    }
  }

  // 'this' — edit only this instance, detach from series
  if (recurrenceAction === 'this') {
    const detachedPatch = { ...patch, recurrenceRule: undefined, recurrenceGroupId: undefined };
    const updateRes = await taskRepository.update(taskData.id!, detachedPatch);
    if (!updateRes.ok) {
      logError('task-action/save-update', updateRes.error);
      showToast('Failed to save task.');
      return;
    }
    setIsModalOpen(false);
    setEditingTask(null);
    showToast('작업이 수정되었습니다 (시리즈에서 분리)', 'success');
    return;
  }

  // 'future' — apply patch to this and all future tasks in the series
  if (recurrenceAction === 'future' && existingTask?.recurrenceGroupId) {
    const seriesResult = await taskRepository.listByGroupId(existingTask.recurrenceGroupId);
    if (!seriesResult.ok) {
      logError('task-action/save-series', seriesResult.error);
      showToast('Failed to save tasks.');
      return;
    }
    const taskDue = existingTask.due ?? '';
    const toUpdate = seriesResult.value.filter(
      (t) => (t.due ?? '') >= taskDue && t.status !== 'Completed',
    );
    for (const t of toUpdate) {
      await taskRepository.update(t.id, patch);
    }
    setIsModalOpen(false);
    setEditingTask(null);
    showToast(`${toUpdate.length}개 작업이 수정되었습니다`, 'success');
    return;
  }

  // Non-recurring or direct update
  const updateRes = await taskRepository.update(taskData.id!, patch);
  if (!updateRes.ok) {
    logError('task-action/save-update', updateRes.error);
    showToast('Failed to save task.');
    return;
  }
  setIsModalOpen(false);
  setEditingTask(null);
  showToast('Task updated', 'success');
}

async function createNewTask(
  taskData: Partial<TaskViewModel>,
  showToast: (msg: string, type?: 'error' | 'success') => void,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: TaskViewModel | null) => void,
): Promise<void> {
  const taskId = crypto.randomUUID();
  const recurrenceGroupId = taskData.recurrenceRule ? crypto.randomUUID() : undefined;
  const taskValidation = createTask({
    id: taskId,
    title: sanitizeText(taskData.title) || 'Untitled Task',
    durationMinutes: taskData.duration ?? 60,
    due: taskData.due ?? getLocalToday(),
    priority: taskData.priority ?? 'Medium',
    status: 'Pending',
    createdAt: Date.now(),
    ...(taskData.description ? { description: sanitizeText(taskData.description) } : {}),
    ...(taskData.recurrenceRule ? { recurrenceRule: taskData.recurrenceRule, recurrenceGroupId } : {}),
    ...(taskData.group ? { group: taskData.group } : {}),
  });

  if (!taskValidation.ok) {
    logError('task-action/create-validate', taskValidation.error);
    showToast('Failed to create task.');
    return;
  }

  const createRes = await taskRepository.create(taskValidation.value);
  if (!createRes.ok) {
    logError('task-action/create', createRes.error);
    showToast('Failed to save task.');
    return;
  }

  setIsModalOpen(false);
  setEditingTask(null);
  showToast('Task created', 'success');
}

/**
 * handleQuickAdd — instantly creates a task with default values and returns it.
 * The task appears in the backlog immediately; the user can edit it afterward.
 */
export async function handleQuickAdd(
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<Task | null> {
  const taskId = crypto.randomUUID();
  const taskValidation = createTask({
    id: taskId,
    title: '새 작업',
    durationMinutes: 60,
    due: getLocalToday(),
    priority: 'Medium',
    status: 'Pending',
    createdAt: Date.now(),
  });

  if (!taskValidation.ok) {
    logError('task-action/quick-add', taskValidation.error);
    showToast('작업 생성 실패');
    return null;
  }

  const createRes = await taskRepository.create(taskValidation.value);
  if (!createRes.ok) {
    logError('task-action/quick-add-save', createRes.error);
    showToast('작업 저장 실패');
    return null;
  }

  showToast('작업이 추가되었습니다', 'success');
  return taskValidation.value;
}
