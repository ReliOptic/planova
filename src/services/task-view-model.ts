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
  /**
   * Deviation in minutes between actual and planned duration.
   * Positive = took longer, negative = finished early.
   * Available for completed tasks (from actualDurationMinutes) or
   * active tasks (from blockDurationMinutes).
   */
  readonly deviationMinutes?: number;
}

/** Deviation severity tier for color-coding. */
export type DeviationTier = 'exact' | 'over-mild' | 'over-heavy' | 'under';

/** Compute the deviation tier from a deviation value in minutes. */
export function getDeviationTier(deviationMinutes: number): DeviationTier {
  if (deviationMinutes <= -1) return 'under';
  if (deviationMinutes <= 5) return 'exact';
  if (deviationMinutes <= 30) return 'over-mild';
  return 'over-heavy';
}

/** Tailwind classes for each deviation tier. */
export const DEVIATION_STYLES: Record<DeviationTier, { bg: string; text: string; badge: string }> = {
  exact:       { bg: 'bg-green-500/10', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  'over-mild': { bg: 'bg-amber-500/10', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  'over-heavy': { bg: 'bg-red-500/10',  text: 'text-red-700',  badge: 'bg-red-100 text-red-700' },
  under:       { bg: 'bg-blue-500/10', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
};

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
      // Completed tasks: compute deviation from stored actualDurationMinutes
      // and restore schedule position from preserved fields
      const deviationMinutes = task.actualDurationMinutes !== undefined
        ? task.actualDurationMinutes - task.durationMinutes
        : undefined;
      return {
        ...task,
        duration: task.durationMinutes,
        ...(deviationMinutes !== undefined ? { deviationMinutes } : {}),
        // Restore schedule position for completed tasks so they render on the timeline
        ...(task.completedScheduledDate !== undefined ? { scheduledDate: task.completedScheduledDate } : {}),
        ...(task.completedStartTime !== undefined ? { startTime: task.completedStartTime } : {}),
        ...(task.completedStartTime !== undefined && task.actualDurationMinutes !== undefined ? {
          endTime: new Date(Date.parse(task.completedStartTime) + task.actualDurationMinutes * 60_000).toISOString(),
          blockDurationMinutes: task.actualDurationMinutes,
        } : {}),
      };
    }
    const blockDurationMinutes = Math.max(
      0,
      Math.round((Date.parse(block.endTime) - Date.parse(block.startTime)) / 60_000),
    );
    const deviationMinutes = blockDurationMinutes - task.durationMinutes;
    return {
      ...task,
      duration: task.durationMinutes,
      scheduledDate: block.scheduledDate,
      startTime: block.startTime,
      endTime: block.endTime,
      scheduleBlockId: block.id,
      blockDurationMinutes,
      deviationMinutes,
    };
  });
}
