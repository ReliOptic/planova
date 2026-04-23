import type { DragEndEvent } from '@dnd-kit/core';
import type { TaskViewModel } from '../services/task-view-model';
import { createScheduleBlock } from '../domain/schedule-block';
import { taskRepository, scheduleBlockRepository } from '../app/dependencies';
import { buildUTCTime } from '../utils/date-utils';
import { getWorkHours } from '../utils/settings';
import { logError, deleteBlocksForTask } from './use-task-crud';

/** Shift an ISO 8601 UTC datetime by a signed number of minutes, preserving precision. */
function shiftIsoMinutes(isoUtc: string, deltaMinutes: number): string {
  return new Date(Date.parse(isoUtc) + deltaMinutes * 60_000).toISOString();
}

/**
 * handleDragEnd — routes drag events to schedule-on-slot or move-to-pending.
 */
export async function handleDragEnd(
  event: DragEndEvent,
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const { active, over } = event;
  if (!over) return;

  const taskId = active.id.toString();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  if (over.id.toString().startsWith('slot-')) {
    await scheduleTaskOnSlot(task, over, showToast);
  } else if (over.id === 'pending-column') {
    await moveTaskToPending(taskId, showToast);
  }
}

async function scheduleTaskOnSlot(
  task: TaskViewModel,
  over: { id: string | number; data: { current?: Record<string, unknown> } },
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const hour: unknown = over.data.current?.hour;
  const minute: unknown = over.data.current?.minute;
  const selectedDate: unknown = over.data.current?.selectedDate;
  if (
    typeof hour !== 'number' ||
    typeof minute !== 'number' ||
    typeof selectedDate !== 'string'
  )
    return;

  const endMinutes = hour * 60 + minute + (task.blockDurationMinutes ?? task.durationMinutes);
  const endHour = Math.floor(endMinutes / 60);
  const endMinute = endMinutes % 60;

  const workHours = getWorkHours();
  if (endHour >= workHours.end) {
    showToast('Task extends past work hours. Try an earlier slot.');
    return;
  }

  const startTime = buildUTCTime(selectedDate, hour, minute);
  const endTime = buildUTCTime(selectedDate, endHour, endMinute);

  const taskResult = await taskRepository.update(task.id, { status: 'Scheduled' });
  if (!taskResult.ok) {
    logError('task-action/drag-schedule', taskResult.error);
    showToast('Failed to schedule task.');
    return;
  }

  await deleteBlocksForTask(task.id);

  const blockValidation = createScheduleBlock({
    id: crypto.randomUUID(),
    taskId: task.id,
    scheduledDate: selectedDate,
    startTime,
    endTime,
  });
  if (!blockValidation.ok) {
    logError('task-action/drag-block-invalid', blockValidation.error);
    showToast('Failed to schedule task.');
    return;
  }
  const createBlock = await scheduleBlockRepository.create(blockValidation.value);
  if (!createBlock.ok) {
    logError('task-action/drag-block-create', createBlock.error);
    showToast('Failed to schedule task.');
    return;
  }
  showToast('Task scheduled', 'success');
}

async function moveTaskToPending(
  taskId: string,
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const taskResult = await taskRepository.update(taskId, { status: 'Pending' });
  if (!taskResult.ok) {
    logError('task-action/drag-pending', taskResult.error);
    showToast('Failed to unschedule task.');
    return;
  }
  await deleteBlocksForTask(taskId);
  showToast('Task unscheduled', 'success');
}

/**
 * handleResizeTask — adjusts start/end times when a task block is resized.
 */
export async function handleResizeTask(
  taskId: string,
  edge: 'top' | 'bottom',
  deltaSlots: number,
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !task.startTime || !task.endTime || !task.scheduledDate || !task.scheduleBlockId)
    return;

  const deltaMinutes = deltaSlots * 15;

  if (edge === 'top') {
    await resizeTop(task, deltaMinutes, showToast);
  } else {
    await resizeBottom(task, deltaMinutes, showToast);
  }
}

/**
 * Drag-resize paths update the ScheduleBlock only. Task.durationMinutes
 * is the planned estimate and is intentionally decoupled from the actual
 * block placement — an edit to the block does not rewrite the plan.
 *
 * New start/end times are computed via direct UTC millisecond arithmetic to
 * avoid a prior bug where `buildUTCTime` (which interprets its hour/minute
 * arguments as local time) was fed UTC hours, silently double-converting in
 * any timezone other than UTC.
 */
async function resizeTop(
  task: TaskViewModel,
  deltaMinutes: number,
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const currentLength = task.blockDurationMinutes ?? task.durationMinutes;
  const newLength = currentLength - deltaMinutes;
  if (newLength < 15) return;

  const startTime = shiftIsoMinutes(task.startTime!, deltaMinutes);

  const blockRes = await scheduleBlockRepository.update(task.scheduleBlockId!, { startTime });
  if (!blockRes.ok) {
    logError('task-action/resize-top-block', blockRes.error);
    showToast('Failed to resize task.');
  }
}

async function resizeBottom(
  task: TaskViewModel,
  deltaMinutes: number,
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const currentLength = task.blockDurationMinutes ?? task.durationMinutes;
  const newLength = currentLength + deltaMinutes;
  if (newLength < 15) return;

  const endTime = new Date(Date.parse(task.startTime!) + newLength * 60_000).toISOString();

  const blockRes = await scheduleBlockRepository.update(task.scheduleBlockId!, { endTime });
  if (!blockRes.ok) {
    logError('task-action/resize-bottom-block', blockRes.error);
    showToast('Failed to resize task.');
  }
}
