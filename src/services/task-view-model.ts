import type { Task } from '../domain/task';
import type { ScheduleBlock } from '../domain/schedule-block';

/**
 * TaskViewModel — UI projection of a v2 domain Task.
 *
 * Extends Task with a `duration` alias (mirrors `durationMinutes`) and optional
 * schedule fields from the associated ScheduleBlock. Components continue to
 * use the flat shape they expect without knowing about the v2 split.
 */
export interface TaskViewModel extends Task {
  /** Alias for durationMinutes — keeps UI components unchanged. */
  readonly duration: number;
  /** YYYY-MM-DD date of the associated ScheduleBlock, if any. */
  readonly scheduledDate?: string;
  /** UTC ISO 8601 start time from the associated ScheduleBlock, if any. */
  readonly startTime?: string;
  /** UTC ISO 8601 end time from the associated ScheduleBlock, if any. */
  readonly endTime?: string;
  /** Id of the associated ScheduleBlock, if any. */
  readonly scheduleBlockId?: string;
}

/**
 * composeViewModels — joins Tasks with their first ScheduleBlock (if any).
 *
 * Each Task maps to exactly one TaskViewModel. The first ScheduleBlock with
 * matching `taskId` is merged in (Phase 1: 1:1 relationship). Tasks without
 * a ScheduleBlock get undefined schedule fields.
 *
 * @param tasks  - All tasks from the task repository.
 * @param blocks - All schedule blocks from the schedule-block repository.
 * @returns Immutable array of TaskViewModels ready for UI rendering.
 */
export function composeViewModels(
  tasks: readonly Task[],
  blocks: readonly ScheduleBlock[],
): readonly TaskViewModel[] {
  const blockByTaskId = new Map<string, ScheduleBlock>();
  for (const block of blocks) {
    if (!blockByTaskId.has(block.taskId)) {
      blockByTaskId.set(block.taskId, block);
    }
  }

  return tasks.map((task): TaskViewModel => {
    const block = blockByTaskId.get(task.id);
    return {
      ...task,
      duration: task.durationMinutes,
      ...(block !== undefined
        ? {
            scheduledDate: block.scheduledDate,
            startTime: block.startTime,
            endTime: block.endTime,
            scheduleBlockId: block.id,
          }
        : {}),
    };
  });
}
