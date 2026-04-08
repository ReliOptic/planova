import type { TaskViewModel } from '../services/task-view-model';
import { createTask } from '../domain/task';
import { taskRepository, scheduleBlockRepository, logger } from '../app/dependencies';
import { buildUTCTime, getLocalToday } from '../utils/date-utils';
import { sanitizeText } from '../utils/sanitize';

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

/**
 * handleDeleteTask — prompts confirmation, deletes task and its schedule blocks.
 */
export async function handleDeleteTask(
  taskId: string,
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  if (!window.confirm('Delete this task?')) return;
  const result = await taskRepository.delete(taskId);
  if (!result.ok) {
    logError('task-action/delete', result.error);
    showToast('Failed to delete task.');
    return;
  }
  await deleteBlocksForTask(taskId);
  showToast('Task deleted', 'success');
}

/**
 * handleSaveTask — creates a new task or updates an existing one.
 * Recomputes ScheduleBlock endTime when duration changes on a scheduled task.
 */
export async function handleSaveTask(
  taskData: Partial<TaskViewModel>,
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: TaskViewModel | null) => void,
): Promise<void> {
  if (taskData.id) {
    await updateExistingTask(taskData, tasks, showToast, setIsModalOpen, setEditingTask);
    return;
  }
  await createNewTask(taskData, showToast, setIsModalOpen, setEditingTask);
}

async function updateExistingTask(
  taskData: Partial<TaskViewModel>,
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: TaskViewModel | null) => void,
): Promise<void> {
  const existingTask = tasks.find((t) => t.id === taskData.id);
  const patch: Parameters<typeof taskRepository.update>[1] = {
    title: taskData.title !== undefined ? sanitizeText(taskData.title) : undefined,
    durationMinutes: taskData.duration,
    due: taskData.due,
    priority: taskData.priority,
    description: taskData.description !== undefined ? sanitizeText(taskData.description) : undefined,
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
  const taskValidation = createTask({
    id: taskId,
    title: sanitizeText(taskData.title) || 'Untitled Task',
    durationMinutes: taskData.duration ?? 60,
    due: taskData.due ?? getLocalToday(),
    priority: taskData.priority ?? 'Medium',
    status: 'Pending',
    createdAt: Date.now(),
    ...(taskData.description ? { description: sanitizeText(taskData.description) } : {}),
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
