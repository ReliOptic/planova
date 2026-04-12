import { type AppError } from './errors';
import { ok, err, type Result } from './result';
import { type RecurrenceRule, validateRecurrenceRule } from './recurrence-rule';

/** Task priority tier. */
export type Priority = 'High' | 'Medium' | 'Low';

/** Lifecycle status of a task. */
export type TaskStatus = 'Pending' | 'Scheduled' | 'In Progress' | 'Completed';

/** 10-color palette for task blocks. */
export type TaskColor =
  | 'blue' | 'indigo' | 'purple' | 'pink' | 'red'
  | 'orange' | 'amber' | 'green' | 'teal' | 'slate';

export const TASK_COLORS: readonly TaskColor[] = [
  'blue', 'indigo', 'purple', 'pink', 'red',
  'orange', 'amber', 'green', 'teal', 'slate',
] as const;

/** Tailwind-compatible color map for task blocks (bg + text). */
export const TASK_COLOR_MAP: Record<TaskColor, { bg: string; text: string; ring: string }> = {
  blue:   { bg: 'bg-blue-500',   text: 'text-white',     ring: 'ring-blue-300' },
  indigo: { bg: 'bg-indigo-500', text: 'text-white',     ring: 'ring-indigo-300' },
  purple: { bg: 'bg-purple-500', text: 'text-white',     ring: 'ring-purple-300' },
  pink:   { bg: 'bg-pink-500',   text: 'text-white',     ring: 'ring-pink-300' },
  red:    { bg: 'bg-red-500',    text: 'text-white',     ring: 'ring-red-300' },
  orange: { bg: 'bg-orange-500', text: 'text-white',     ring: 'ring-orange-300' },
  amber:  { bg: 'bg-amber-400',  text: 'text-amber-900', ring: 'ring-amber-300' },
  green:  { bg: 'bg-green-500',  text: 'text-white',     ring: 'ring-green-300' },
  teal:   { bg: 'bg-teal-500',   text: 'text-white',     ring: 'ring-teal-300' },
  slate:  { bg: 'bg-slate-500',  text: 'text-white',     ring: 'ring-slate-300' },
};

const VALID_PRIORITIES: ReadonlySet<string> = new Set<Priority>(['High', 'Medium', 'Low']);
const VALID_STATUSES: ReadonlySet<string> = new Set<TaskStatus>([
  'Pending',
  'Scheduled',
  'In Progress',
  'Completed',
]);

/**
 * Task — v2 domain entity representing a backlog item.
 *
 * Invariants:
 * - `id` is a non-empty string (UUID recommended).
 * - `title` is a non-empty string (max 255 chars by convention).
 * - `durationMinutes` is a positive integer (> 0).
 * - `due` is an optional YYYY-MM-DD date string.
 * - `priority` must be one of Priority.
 * - `status` must be one of TaskStatus.
 * - `createdAt` is a Unix epoch ms timestamp.
 * - `completedAt` is only set when `status === 'Completed'`.
 * - `schemaVersion` is always 2 for v2 entities.
 */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  /** Estimated effort in minutes. Must be > 0. */
  readonly durationMinutes: number;
  /** Optional due date as YYYY-MM-DD. */
  readonly due?: string;
  readonly priority: Priority;
  readonly status: TaskStatus;
  /** Unix epoch ms. Set at creation time. */
  readonly createdAt: number;
  /** Unix epoch ms. Only present when status is 'Completed'. */
  readonly completedAt?: number;
  /** Optional display color for timeline blocks. */
  readonly color?: TaskColor;
  /** Recurrence rule — if set, the task repeats. */
  readonly recurrenceRule?: RecurrenceRule;
  /** Groups recurring task instances into a series. */
  readonly recurrenceGroupId?: string;
  /** Optional project/group label for categorization. */
  readonly group?: string;
  /** Actual duration in minutes, recorded at completion time from ScheduleBlock. */
  readonly actualDurationMinutes?: number;
  /** Scheduled date preserved at completion (YYYY-MM-DD), since ScheduleBlock is deleted. */
  readonly completedScheduledDate?: string;
  /** Start time preserved at completion (ISO 8601 UTC), since ScheduleBlock is deleted. */
  readonly completedStartTime?: string;
  readonly schemaVersion: 2;
}

/** Input shape for createTask — all fields except id, createdAt, schemaVersion. */
export interface CreateTaskInput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly durationMinutes: number;
  readonly due?: string;
  readonly priority: string;
  readonly status: string;
  readonly createdAt: number;
  readonly completedAt?: number;
  readonly color?: string;
  readonly recurrenceRule?: RecurrenceRule;
  readonly recurrenceGroupId?: string;
  readonly group?: string;
  readonly actualDurationMinutes?: number;
  readonly completedScheduledDate?: string;
  readonly completedStartTime?: string;
}

/**
 * Factory that validates input and constructs a Task.
 *
 * @returns ok(Task) on success, err(AppError) on first validation failure.
 */
export function createTask(input: CreateTaskInput): Result<Task, AppError> {
  if (!input.title || input.title.trim().length === 0) {
    return err({ kind: 'validation/invalid-field', field: 'title', reason: 'must not be empty' });
  }

  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
    return err({
      kind: 'validation/invalid-field',
      field: 'durationMinutes',
      reason: 'must be a positive number',
    });
  }

  if (!VALID_PRIORITIES.has(input.priority)) {
    return err({
      kind: 'validation/invalid-field',
      field: 'priority',
      reason: `must be one of: ${[...VALID_PRIORITIES].join(', ')}`,
    });
  }

  if (!VALID_STATUSES.has(input.status)) {
    return err({
      kind: 'validation/invalid-field',
      field: 'status',
      reason: `must be one of: ${[...VALID_STATUSES].join(', ')}`,
    });
  }

  if (input.recurrenceRule !== undefined) {
    const ruleError = validateRecurrenceRule(input.recurrenceRule);
    if (ruleError !== null) {
      return err({
        kind: 'validation/invalid-field',
        field: 'recurrenceRule',
        reason: ruleError,
      });
    }
  }

  const task: Task = {
    id: input.id,
    title: input.title.trim(),
    durationMinutes: input.durationMinutes,
    priority: input.priority as Priority,
    status: input.status as TaskStatus,
    createdAt: input.createdAt,
    schemaVersion: 2,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.due !== undefined ? { due: input.due } : {}),
    ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
    ...(input.color !== undefined && TASK_COLORS.includes(input.color as TaskColor) ? { color: input.color as TaskColor } : {}),
    ...(input.recurrenceRule !== undefined ? { recurrenceRule: input.recurrenceRule } : {}),
    ...(input.recurrenceGroupId !== undefined ? { recurrenceGroupId: input.recurrenceGroupId } : {}),
    ...(input.group !== undefined ? { group: input.group } : {}),
    ...(input.actualDurationMinutes !== undefined ? { actualDurationMinutes: input.actualDurationMinutes } : {}),
    ...(input.completedScheduledDate !== undefined ? { completedScheduledDate: input.completedScheduledDate } : {}),
    ...(input.completedStartTime !== undefined ? { completedStartTime: input.completedStartTime } : {}),
  };

  return ok(task);
}
