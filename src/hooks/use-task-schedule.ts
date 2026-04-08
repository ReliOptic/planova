import type { DragEndEvent } from '@dnd-kit/core';
import type { TaskViewModel } from '../services/task-view-model';
import { createScheduleBlock } from '../domain/schedule-block';
import { taskRepository, scheduleBlockRepository } from '../app/dependencies';
import { buildUTCTime } from '../utils/date-utils';
import { getWorkHours } from '../utils/settings';
import { logError, deleteBlocksForTask } from './use-task-crud';

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

  const endMinutes = hour * 60 + minute + task.durationMinutes;
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

async function resizeTop(
  task: TaskViewModel,
  deltaMinutes: number,
  showToast: (msg: string, type?: 'error' | 'success') => void,
): Promise<void> {
  const startDate = new Date(task.startTime!);
  const newStartMs = startDate.getTime() + deltaMinutes * 60_000;
  const newStart = new Date(newStartMs);
  const newDuration = task.durationMinutes - deltaMinutes;
  if (newDuration < 15) return;
  const startTime = buildUTCTime(
    task.scheduledDate!,
    newStart.getUTCHours(),
    newStart.getUTCMinutes(),
  );
  const taskRes = await taskRepository.update(task.id, { durationMinutes: newDuration });
  if (!taskRes.ok) {
    logError('task-action/resize-top-task', taskRes.error);
    showToast('Failed to resize task.');
    return;
  }
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
  const newDuration = task.durationMinutes + deltaMinutes;
  if (newDuration < 15) return;
  const startDate = new Date(task.startTime!);
  const endMs = startDate.getTime() + newDuration * 60_000;
  const newEnd = new Date(endMs);
  const endTime = buildUTCTime(
    task.scheduledDate!,
    newEnd.getUTCHours(),
    newEnd.getUTCMinutes(),
  );
  const taskRes = await taskRepository.update(task.id, { durationMinutes: newDuration });
  if (!taskRes.ok) {
    logError('task-action/resize-bottom-task', taskRes.error);
    showToast('Failed to resize task.');
    return;
  }
  const blockRes = await scheduleBlockRepository.update(task.scheduleBlockId!, { endTime });
  if (!blockRes.ok) {
    logError('task-action/resize-bottom-block', blockRes.error);
    showToast('Failed to resize task.');
  }
}
