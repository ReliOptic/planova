import type { Task } from '../domain/task';
import type { ScheduleBlock } from '../domain/schedule-block';

/**
 * TaskViewModel — UI projection of a v2 domain Task, optionally joined with
 * the first associated ScheduleBlock.
 *
 * Design note on duration:
 * - `durationMinutes` (inherited from Task) is the user's *planned* estimate.
 * - `blockDurationMinutes` (derived) is the *actual* length of the placed
 *   ScheduleBlock. These can diverge: dragging the block bottom edge resizes
 *   the block only, without rewriting the plan.
 * - UI rendering that cares about "how tall is the block on the timeline"
 *   should prefer `blockDurationMinutes ?? durationMinutes`.
 */
export interface TaskViewModel extends Task {
  /** Alias for durationMinutes — kept for components that render planned effort. */
  readonly duration: number;
  /** YYYY-MM-DD date of the associated ScheduleBlock, if any. */
  readonly scheduledDate?: string;
  /** UTC ISO 8601 start time from the associated ScheduleBlock, if any. */
  readonly startTime?: string;
  /** UTC ISO 8601 end time from the associated ScheduleBlock, if any. */
  readonly endTime?: string;
  /** Id of the associated ScheduleBlock, if any. */
  readonly scheduleBlockId?: string;
  /**
   * Actual length of the associated ScheduleBlock in minutes, if any.
   * Derived from endTime − startTime. Absent when no block is joined.
   */
  readonly blockDurationMinutes?: number;
}

/**
 * composeViewModels — joins Tasks with their associated ScheduleBlock.
 *
 * The first ScheduleBlock with matching `taskId` is merged into each Task.
 * Tasks without a ScheduleBlock get undefined schedule fields. The UI layer
 * currently renders one block per task; the multi-block case is reserved for
 * a future iteration and is handled by pushing extra blocks into `blockDurationMinutes`
 * / projection logic at that point — not here.
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
    if (block === undefined) {
      return {
        ...task,
        duration: task.durationMinutes,
      };
    }
    const blockDurationMinutes = Math.max(
      0,
      Math.round((Date.parse(block.endTime) - Date.parse(block.startTime)) / 60_000),
    );
    return {
      ...task,
      duration: task.durationMinutes,
      scheduledDate: block.scheduledDate,
      startTime: block.startTime,
      endTime: block.endTime,
      scheduleBlockId: block.id,
      blockDurationMinutes,
    };
  });
}
