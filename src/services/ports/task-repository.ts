import { type Result } from '../../domain/result';
import { type AppError } from '../../domain/errors';
import { type Task, type TaskStatus } from '../../domain/task';
import { type ScheduleBlock } from '../../domain/schedule-block';

/**
 * ITaskRepository — port interface for task persistence.
 *
 * All methods return Result to make error handling explicit at the call site.
 * Implementations may be Firestore, IndexedDB, or in-memory (tests).
 */
export interface ITaskRepository {
  /** Return all tasks for the current user. */
  list(): Promise<Result<readonly Task[], AppError>>;

  /** Return tasks filtered by a given status. */
  listByStatus(status: TaskStatus): Promise<Result<readonly Task[], AppError>>;

  /** Return all tasks sharing a recurrenceGroupId (recurring series). */
  listByGroupId(groupId: string): Promise<Result<readonly Task[], AppError>>;

  /**
   * Fetch a single task by id.
   * Returns err('repo/not-found') when no document exists.
   */
  get(id: string): Promise<Result<Task, AppError>>;

  /** Persist a new task. Fails with err('repo/write-failed') on storage error. */
  create(task: Task): Promise<Result<void, AppError>>;

  /**
   * Apply a partial update to an existing task.
   * `id` and `schemaVersion` are immutable and excluded from the patch type.
   */
  update(
    id: string,
    patch: Partial<Omit<Task, 'id' | 'schemaVersion'>>,
  ): Promise<Result<void, AppError>>;

  /** Delete a task by id. No-op if the task does not exist. */
  delete(id: string): Promise<Result<void, AppError>>;

  /**
   * Subscribe to live task updates.
   * @param onChange — called with the full current list on every change.
   * @returns unsubscribe function — call to stop receiving updates.
   */
  watch(onChange: (tasks: readonly Task[]) => void): () => void;
}

/**
 * IScheduleBlockRepository — port interface for schedule-block persistence.
 *
 * Blocks are keyed by date for efficient timeline rendering.
 */
export interface IScheduleBlockRepository {
  /** Return all blocks for a specific calendar date (YYYY-MM-DD). */
  listForDate(date: string): Promise<Result<readonly ScheduleBlock[], AppError>>;

  /**
   * Return all blocks within an inclusive date range.
   * @param startDate — YYYY-MM-DD
   * @param endDate   — YYYY-MM-DD
   */
  listForRange(
    startDate: string,
    endDate: string,
  ): Promise<Result<readonly ScheduleBlock[], AppError>>;

  /** Return all blocks associated with a given task id. */
  getByTaskId(taskId: string): Promise<Result<readonly ScheduleBlock[], AppError>>;

  /** Persist a new schedule block. */
  create(block: ScheduleBlock): Promise<Result<void, AppError>>;

  /**
   * Apply a partial update to an existing block.
   * `id`, `taskId`, and `schemaVersion` are immutable and excluded from patch.
   */
  update(
    id: string,
    patch: Partial<Omit<ScheduleBlock, 'id' | 'taskId' | 'schemaVersion'>>,
  ): Promise<Result<void, AppError>>;

  /** Delete a block by id. */
  delete(id: string): Promise<Result<void, AppError>>;

  /**
   * Subscribe to live updates for a specific date.
   * @param date     — YYYY-MM-DD
   * @param onChange — called with the full current block list on every change.
   * @returns unsubscribe function.
   */
  watch(date: string, onChange: (blocks: readonly ScheduleBlock[]) => void): () => void;
}
