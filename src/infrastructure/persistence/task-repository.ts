import { liveQuery } from 'dexie';
import type { AppError } from '../../domain/errors';
import { ok, err } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { Task, TaskStatus } from '../../domain/task';
import type { ITaskRepository } from '../../services/ports/task-repository';
import { PlanovaDatabase } from './db';

/**
 * DexieTaskRepository — IndexedDB-backed implementation of ITaskRepository.
 *
 * Each instance owns its own PlanovaDatabase reference so tests can
 * inject isolated databases via the constructor.
 */
export class DexieTaskRepository implements ITaskRepository {
  constructor(private readonly _db: PlanovaDatabase = new PlanovaDatabase()) {}

  /** Return all tasks ordered by createdAt descending. */
  async list(): Promise<Result<readonly Task[], AppError>> {
    try {
      const tasks = await this._db.tasks.orderBy('createdAt').reverse().toArray();
      return ok(tasks);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'task.list', cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Return all tasks with the given status. */
  async listByStatus(status: TaskStatus): Promise<Result<readonly Task[], AppError>> {
    try {
      const tasks = await this._db.tasks.where('status').equals(status).toArray();
      return ok(tasks);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'task.listByStatus', status, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Fetch a single task by id. Returns err('repo/not-found') when absent. */
  async get(id: string): Promise<Result<Task, AppError>> {
    try {
      const task = await this._db.tasks.get(id);
      if (task === undefined) {
        return err({ kind: 'repo/not-found', id });
      }
      return ok(task);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'task.get', id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Persist a new task. */
  async create(task: Task): Promise<Result<void, AppError>> {
    try {
      await this._db.tasks.add(task);
      return ok(undefined);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'task.create', id: task.id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Apply a partial update to an existing task. */
  async update(
    id: string,
    patch: Partial<Omit<Task, 'id' | 'schemaVersion'>>,
  ): Promise<Result<void, AppError>> {
    try {
      const count = await this._db.tasks.update(id, patch as Partial<Task>);
      if (count === 0) {
        return err({ kind: 'repo/not-found', id });
      }
      return ok(undefined);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'task.update', id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Delete a task by id. No-op if the task does not exist. */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      await this._db.tasks.delete(id);
      return ok(undefined);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'task.delete', id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /**
   * Subscribe to live task updates.
   * @param onChange — called with the full current list on every change.
   * @returns unsubscribe function.
   */
  watch(onChange: (tasks: readonly Task[]) => void): () => void {
    const subscription = liveQuery(() =>
      this._db.tasks.orderBy('createdAt').reverse().toArray(),
    ).subscribe({
      next: (tasks) => onChange(tasks),
      error: (cause: unknown) => {
        console.log(JSON.stringify({ level: 'error', op: 'task.watch', cause: String(cause) }));
      },
    });
    return () => subscription.unsubscribe();
  }
}
