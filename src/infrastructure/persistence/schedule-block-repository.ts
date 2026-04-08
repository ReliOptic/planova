import { liveQuery } from 'dexie';
import type { AppError } from '../../domain/errors';
import { ok, err } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { ScheduleBlock } from '../../domain/schedule-block';
import type { IScheduleBlockRepository } from '../../services/ports/task-repository';
import { PlanovaDatabase } from './db';

/**
 * DexieScheduleBlockRepository — IndexedDB-backed implementation of IScheduleBlockRepository.
 *
 * Each instance owns its own PlanovaDatabase reference so tests can
 * inject isolated databases via the constructor.
 */
export class DexieScheduleBlockRepository implements IScheduleBlockRepository {
  constructor(private readonly _db: PlanovaDatabase = new PlanovaDatabase()) {}

  /** Return all blocks for a specific calendar date (YYYY-MM-DD). */
  async listForDate(date: string): Promise<Result<readonly ScheduleBlock[], AppError>> {
    try {
      const blocks = await this._db.scheduleBlocks
        .where('scheduledDate')
        .equals(date)
        .toArray();
      return ok(blocks);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.listForDate', date, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Return all blocks within an inclusive date range [startDate, endDate]. */
  async listForRange(
    startDate: string,
    endDate: string,
  ): Promise<Result<readonly ScheduleBlock[], AppError>> {
    try {
      const blocks = await this._db.scheduleBlocks
        .where('scheduledDate')
        .between(startDate, endDate, true, true)
        .toArray();
      return ok(blocks);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.listForRange', startDate, endDate, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Return all blocks associated with a given task id. */
  async getByTaskId(taskId: string): Promise<Result<readonly ScheduleBlock[], AppError>> {
    try {
      const blocks = await this._db.scheduleBlocks
        .where('taskId')
        .equals(taskId)
        .toArray();
      return ok(blocks);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.getByTaskId', taskId, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Fetch a single block by id. Returns err('repo/not-found') when absent. */
  async get(id: string): Promise<Result<ScheduleBlock, AppError>> {
    try {
      const block = await this._db.scheduleBlocks.get(id);
      if (block === undefined) {
        return err({ kind: 'repo/not-found', id });
      }
      return ok(block);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.get', id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Persist a new schedule block. */
  async create(block: ScheduleBlock): Promise<Result<void, AppError>> {
    try {
      await this._db.scheduleBlocks.add(block);
      return ok(undefined);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.create', id: block.id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Apply a partial update to an existing block. */
  async update(
    id: string,
    patch: Partial<Omit<ScheduleBlock, 'id' | 'taskId' | 'schemaVersion'>>,
  ): Promise<Result<void, AppError>> {
    try {
      const count = await this._db.scheduleBlocks.update(id, patch as Partial<ScheduleBlock>);
      if (count === 0) {
        return err({ kind: 'repo/not-found', id });
      }
      return ok(undefined);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.update', id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** Delete a block by id. */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      await this._db.scheduleBlocks.delete(id);
      return ok(undefined);
    } catch (cause) {
      console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.delete', id, cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /**
   * Subscribe to live updates for a specific date.
   * @param date     — YYYY-MM-DD
   * @param onChange — called with the full current block list on every change.
   * @returns unsubscribe function.
   */
  watch(date: string, onChange: (blocks: readonly ScheduleBlock[]) => void): () => void {
    const subscription = liveQuery(() =>
      this._db.scheduleBlocks.where('scheduledDate').equals(date).toArray(),
    ).subscribe({
      next: (blocks) => onChange(blocks),
      error: (cause: unknown) => {
        console.log(JSON.stringify({ level: 'error', op: 'scheduleBlock.watch', date, cause: String(cause) }));
      },
    });
    return () => subscription.unsubscribe();
  }
}
