import type { Task } from './task';
import type { ScheduleBlock } from './schedule-block';

/**
 * BackupBundle — portable snapshot of user data for export/import.
 *
 * Invariants:
 * - `format` is always 'planova-backup' (format discriminator).
 * - `version` is always 1 (bundle format version, not schema version).
 * - `exportedAt` is a Unix epoch ms timestamp.
 * - `schemaVersion` reflects the DB schema version at export time (2+).
 * - `tasks` and `scheduleBlocks` are non-nullable arrays.
 */
export interface BackupBundle {
  readonly format: 'planova-backup';
  readonly version: 1;
  /** Unix epoch ms when the export was created. */
  readonly exportedAt: number;
  /** DB schema version at export time. */
  readonly schemaVersion: 2;
  readonly tasks: readonly Task[];
  readonly scheduleBlocks: readonly ScheduleBlock[];
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['durationMinutes'] === 'number' &&
    typeof v['priority'] === 'string' &&
    typeof v['status'] === 'string' &&
    typeof v['createdAt'] === 'number' &&
    v['schemaVersion'] === 2
  );
}

function isScheduleBlock(value: unknown): value is ScheduleBlock {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['taskId'] === 'string' &&
    typeof v['scheduledDate'] === 'string' &&
    typeof v['startTime'] === 'string' &&
    typeof v['endTime'] === 'string' &&
    v['schemaVersion'] === 2
  );
}

/**
 * Runtime type guard for BackupBundle.
 * Validates every field shape — no blind casts.
 */
export function isBackupBundle(value: unknown): value is BackupBundle {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;

  if (v['format'] !== 'planova-backup') return false;
  if (v['version'] !== 1) return false;
  if (typeof v['exportedAt'] !== 'number') return false;
  if (v['schemaVersion'] !== 2) return false;

  if (!Array.isArray(v['tasks'])) return false;
  if (!Array.isArray(v['scheduleBlocks'])) return false;

  if (!v['tasks'].every(isTask)) return false;
  if (!v['scheduleBlocks'].every(isScheduleBlock)) return false;

  return true;
}
