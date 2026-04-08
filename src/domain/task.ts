import { type AppError } from './errors';
import { ok, err, type Result } from './result';

/** Task priority tier. */
export type Priority = 'High' | 'Medium' | 'Low';

/** Lifecycle status of a task. */
export type TaskStatus = 'Pending' | 'Scheduled' | 'In Progress' | 'Completed';

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
  };

  return ok(task);
}
