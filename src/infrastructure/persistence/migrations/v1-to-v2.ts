import { type Task } from '../../../domain/task';
import { type ScheduleBlock } from '../../../domain/schedule-block';
import { type LegacyTaskV1 } from './legacy-task-v1';

/** A record that was skipped during migration, with a machine-readable reason. */
export interface SkippedRecord {
  readonly id: string;
  readonly reason: 'incomplete-schedule-fields';
}

/**
 * Output of a v1 → v2 migration pass.
 *
 * - `tasks` — migrated Task entities (schemaVersion 2).
 * - `scheduleBlocks` — split-out ScheduleBlock entities (schemaVersion 2).
 * - `skipped` — v1 records that could not be fully migrated.
 */
export interface MigrationResult {
  readonly tasks: readonly Task[];
  readonly scheduleBlocks: readonly ScheduleBlock[];
  readonly skipped: readonly SkippedRecord[];
}

/** Returns true when all three schedule fields are non-empty strings. */
function hasCompleteScheduleFields(legacy: LegacyTaskV1): boolean {
  return (
    typeof legacy.scheduledDate === 'string' && legacy.scheduledDate.length > 0 &&
    typeof legacy.startTime === 'string' && legacy.startTime.length > 0 &&
    typeof legacy.endTime === 'string' && legacy.endTime.length > 0
  );
}

/** Builds the base Task v2 entity from a v1 record. uid is dropped. */
function buildTask(legacy: LegacyTaskV1, overrideStatus?: Task['status']): Task {
  const task: Task = {
    id: legacy.id,
    title: legacy.title,
    durationMinutes: legacy.duration,
    priority: legacy.priority,
    status: overrideStatus ?? legacy.status,
    createdAt: legacy.createdAt,
    schemaVersion: 2,
  };

  // Spread optional fields only when present to keep objects lean.
  return {
    ...task,
    ...(legacy.description !== undefined ? { description: legacy.description } : {}),
    ...(legacy.due !== undefined ? { due: legacy.due } : {}),
    ...(legacy.completedAt !== undefined ? { completedAt: legacy.completedAt } : {}),
  };
}

/** Builds a ScheduleBlock v2 entity from a v1 record that has complete schedule fields. */
function buildScheduleBlock(legacy: LegacyTaskV1): ScheduleBlock {
  return {
    id: crypto.randomUUID(),
    taskId: legacy.id,
    // Non-null assertion safe: caller only calls this after hasCompleteScheduleFields check.
    scheduledDate: legacy.scheduledDate as string,
    startTime: legacy.startTime as string,
    endTime: legacy.endTime as string,
    schemaVersion: 2,
  };
}

/**
 * Pure function that migrates an array of v1 task documents into the v2
 * split shape (Task + ScheduleBlock).
 *
 * Rules:
 * - `uid` is dropped (auth removed in v2).
 * - `duration` is renamed to `durationMinutes`.
 * - `schemaVersion` is set to 2 on all output entities.
 * - Tasks with `status: 'Scheduled' | 'In Progress'` that are missing any
 *   of `scheduledDate`, `startTime`, or `endTime` are downgraded to
 *   `'Pending'` and added to `skipped` with reason `'incomplete-schedule-fields'`.
 * - Completed tasks always keep their status regardless of schedule fields.
 * - Documents with `schemaVersion` absent or explicitly `1` are treated as v1.
 *
 * @param legacy - Array of v1 task documents (may be empty).
 * @returns MigrationResult with tasks, scheduleBlocks, and skipped arrays.
 */
export function migrateV1ToV2(legacy: readonly LegacyTaskV1[]): MigrationResult {
  const tasks: Task[] = [];
  const scheduleBlocks: ScheduleBlock[] = [];
  const skipped: SkippedRecord[] = [];

  for (const record of legacy) {
    const isActiveScheduleStatus =
      record.status === 'Scheduled' || record.status === 'In Progress';

    if (isActiveScheduleStatus && !hasCompleteScheduleFields(record)) {
      // Downgrade to Pending; record in skipped list.
      tasks.push(buildTask(record, 'Pending'));
      skipped.push({ id: record.id, reason: 'incomplete-schedule-fields' });
      continue;
    }

    tasks.push(buildTask(record));

    if (hasCompleteScheduleFields(record)) {
      scheduleBlocks.push(buildScheduleBlock(record));
    }
  }

  return { tasks, scheduleBlocks, skipped };
}
