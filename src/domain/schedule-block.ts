import { type AppError } from './errors';
import { ok, err, type Result } from './result';

/**
 * ScheduleBlock — v2 domain entity representing a time allocation on the timeline.
 *
 * Invariants:
 * - `id` is a non-empty string.
 * - `taskId` references a valid Task id.
 * - `scheduledDate` is a YYYY-MM-DD string.
 * - `startTime` is an ISO 8601 UTC datetime string.
 * - `endTime` is an ISO 8601 UTC datetime string after startTime.
 * - `schemaVersion` is always 2 for v2 entities.
 */
export interface ScheduleBlock {
  readonly id: string;
  readonly taskId: string;
  /** Date of the block in YYYY-MM-DD format (local calendar date). */
  readonly scheduledDate: string;
  /** Start of the block as ISO 8601 UTC (e.g. "2026-04-05T09:00:00.000Z"). */
  readonly startTime: string;
  /** End of the block as ISO 8601 UTC. Must be after startTime. */
  readonly endTime: string;
  readonly schemaVersion: 2;
}

/** Input shape for createScheduleBlock. */
export interface CreateScheduleBlockInput {
  readonly id: string;
  readonly taskId: string;
  readonly scheduledDate: string;
  readonly startTime: string;
  readonly endTime: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoUtc(value: string): boolean {
  if (!value) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

/**
 * Factory that validates input and constructs a ScheduleBlock.
 *
 * @returns ok(ScheduleBlock) on success, err(AppError) on first validation failure.
 */
export function createScheduleBlock(input: CreateScheduleBlockInput): Result<ScheduleBlock, AppError> {
  if (!input.id || input.id.trim().length === 0) {
    return err({ kind: 'validation/invalid-field', field: 'id', reason: 'must not be empty' });
  }

  if (!input.taskId || input.taskId.trim().length === 0) {
    return err({ kind: 'validation/invalid-field', field: 'taskId', reason: 'must not be empty' });
  }

  if (!DATE_RE.test(input.scheduledDate)) {
    return err({
      kind: 'validation/invalid-field',
      field: 'scheduledDate',
      reason: 'must be a YYYY-MM-DD string',
    });
  }

  if (!isValidIsoUtc(input.startTime)) {
    return err({
      kind: 'validation/invalid-field',
      field: 'startTime',
      reason: 'must be a valid ISO 8601 UTC datetime string',
    });
  }

  if (!isValidIsoUtc(input.endTime)) {
    return err({
      kind: 'validation/invalid-field',
      field: 'endTime',
      reason: 'must be a valid ISO 8601 UTC datetime string',
    });
  }

  if (Date.parse(input.endTime) <= Date.parse(input.startTime)) {
    return err({
      kind: 'validation/invalid-field',
      field: 'endTime',
      reason: 'must be after startTime',
    });
  }

  return ok({
    id: input.id,
    taskId: input.taskId,
    scheduledDate: input.scheduledDate,
    startTime: input.startTime,
    endTime: input.endTime,
    schemaVersion: 2,
  });
}
