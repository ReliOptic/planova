import { ok, err, type Result } from '../domain/result';
import { isBackupBundle, type BackupBundle } from '../domain/backup-bundle';
import { type BackupError } from '../domain/backup-errors';
import type { PlanovaDatabase } from '../infrastructure/persistence/db';

/**
 * Summary returned after a successful import operation.
 */
export interface ImportSummary {
  readonly tasksImported: number;
  readonly scheduleBlocksImported: number;
  readonly conflictsSkipped: number;
}

/**
 * BackupService — handles JSON export/import of user data.
 *
 * Never exports `aiCredentials` or `aiCache` tables.
 */
export class BackupService {
  constructor(private readonly db: PlanovaDatabase) {}

  /**
   * Exports all tasks and scheduleBlocks into a BackupBundle.
   *
   * @returns ok(BackupBundle) on success, err(BackupError) on failure.
   */
  async export(): Promise<Result<BackupBundle, BackupError>> {
    try {
      const [tasks, scheduleBlocks] = await Promise.all([
        this.db.tasks.toArray(),
        this.db.scheduleBlocks.toArray(),
      ]);

      const bundle: BackupBundle = {
        format: 'planova-backup',
        version: 1,
        exportedAt: Date.now(),
        schemaVersion: 2,
        tasks,
        scheduleBlocks,
      };

      return ok(bundle);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({ event: 'backup.export.failed', cause }));
      return err({ kind: 'backup/io-failed', cause });
    }
  }

  /**
   * Imports a BackupBundle into the database.
   *
   * - `replace`: clears existing tasks + scheduleBlocks, then bulk-inserts.
   * - `merge`: skips items whose id already exists (counted as conflicts).
   *
   * @returns ok(ImportSummary) on success, err(BackupError) on failure.
   */
  async import(
    bundle: BackupBundle,
    mode: 'replace' | 'merge',
  ): Promise<Result<ImportSummary, BackupError>> {
    if (!isBackupBundle(bundle)) {
      return err({ kind: 'backup/invalid-bundle', reason: 'bundle failed type guard' });
    }

    try {
      if (mode === 'replace') {
        return await this._importReplace(bundle);
      }
      return await this._importMerge(bundle);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({ event: 'backup.import.failed', mode, cause }));
      return err({ kind: 'backup/io-failed', cause });
    }
  }

  private async _importReplace(bundle: BackupBundle): Promise<Result<ImportSummary, BackupError>> {
    await this.db.transaction('rw', [this.db.tasks, this.db.scheduleBlocks], async () => {
      await this.db.tasks.clear();
      await this.db.scheduleBlocks.clear();
      await this.db.tasks.bulkPut([...bundle.tasks]);
      await this.db.scheduleBlocks.bulkPut([...bundle.scheduleBlocks]);
    });

    return ok({
      tasksImported: bundle.tasks.length,
      scheduleBlocksImported: bundle.scheduleBlocks.length,
      conflictsSkipped: 0,
    });
  }

  private async _importMerge(bundle: BackupBundle): Promise<Result<ImportSummary, BackupError>> {
    let tasksImported = 0;
    let blocksImported = 0;
    let conflictsSkipped = 0;

    await this.db.transaction('rw', [this.db.tasks, this.db.scheduleBlocks], async () => {
      for (const task of bundle.tasks) {
        const existing = await this.db.tasks.get(task.id);
        if (existing !== undefined) {
          conflictsSkipped++;
        } else {
          await this.db.tasks.put(task);
          tasksImported++;
        }
      }

      for (const block of bundle.scheduleBlocks) {
        const existing = await this.db.scheduleBlocks.get(block.id);
        if (existing !== undefined) {
          conflictsSkipped++;
        } else {
          await this.db.scheduleBlocks.put(block);
          blocksImported++;
        }
      }
    });

    return ok({
      tasksImported,
      scheduleBlocksImported: blocksImported,
      conflictsSkipped,
    });
  }
}
