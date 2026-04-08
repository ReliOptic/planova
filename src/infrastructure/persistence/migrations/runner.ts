import { type Result } from '../../../domain/result';
import { ok, err } from '../../../domain/result';
import { type AppError } from '../../../domain/errors';
import { type PlanovaDatabase } from '../db';
import { type LegacyTaskV1 } from './legacy-task-v1';
import { migrateV1ToV2, type MigrationResult } from './v1-to-v2';
import type { Logger } from '../../logger/logger';

const META_KEY_SCHEMA_VERSION = 'schemaVersion';
const CURRENT_SCHEMA_VERSION = 2;
const EMPTY_RESULT: MigrationResult = { tasks: [], scheduleBlocks: [], skipped: [] };

/**
 * Reads the stored schemaVersion from the `meta` table.
 * Returns 1 (default) when the row is absent.
 */
async function readStoredVersion(db: PlanovaDatabase): Promise<number> {
  const row = await db.meta.get(META_KEY_SCHEMA_VERSION);
  if (row === undefined) return 1;
  return typeof row.value === 'number' ? row.value : Number(row.value);
}

/**
 * runMigrations — idempotent schema migration runner.
 *
 * Checks the `meta` table for the current schemaVersion.
 * - If already at v2, returns an empty MigrationResult immediately.
 * - If at v1 (or absent), reads all tasks, runs `migrateV1ToV2`, writes
 *   split data into v2 tables inside a single Dexie transaction, then
 *   bumps the meta version to 2.
 * - Any error during the transaction rolls back automatically (Dexie
 *   wraps writes in an IDB transaction) and returns an AppError.
 *
 * @param db - Open PlanovaDatabase instance.
 * @returns ok(MigrationResult) on success, err(AppError) on failure.
 */
export async function runMigrations(
  db: PlanovaDatabase,
  log?: Logger,
): Promise<Result<MigrationResult, AppError>> {
  try {
    const storedVersion = await readStoredVersion(db);

    if (storedVersion >= CURRENT_SCHEMA_VERSION) {
      return ok(EMPTY_RESULT);
    }

    // Read all tasks as legacy v1 shape before splitting.
    const rawTasks = (await db.tasks.toArray()) as unknown as LegacyTaskV1[];

    const result = migrateV1ToV2(rawTasks);

    await db.transaction('rw', [db.tasks, db.scheduleBlocks, db.meta], async () => {
      // Clear existing task rows (will be replaced with v2 shape).
      await db.tasks.clear();

      // Write migrated tasks and schedule blocks.
      for (const task of result.tasks) {
        await db.tasks.put(task);
      }
      for (const block of result.scheduleBlocks) {
        await db.scheduleBlocks.put(block);
      }

      // Bump the stored schema version.
      await db.meta.put({ key: META_KEY_SCHEMA_VERSION, value: CURRENT_SCHEMA_VERSION });
    });

    return ok(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);

    if (log !== undefined) {
      log.error('migration/run-failed', message, { cause: message });
    } else {
      console.error(
        JSON.stringify({ level: 'error', event: 'migration/run-failed', cause: message }),
      );
    }

    return err({ kind: 'repo/write-failed', cause: message });
  }
}
