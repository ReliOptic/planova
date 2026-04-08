/**
 * LegacyTaskV1 — Firestore v1 task shape.
 *
 * The v1 document overloads the Task entity: schedule fields
 * (`scheduledDate`, `startTime`, `endTime`) are embedded directly
 * on the task document instead of being split into a ScheduleBlock.
 *
 * This interface is only used in migration code. Do not import
 * outside of `src/infrastructure/persistence/migrations/`.
 */
export interface LegacyTaskV1 {
  readonly id: string;
  readonly uid: string;
  readonly title: string;
  readonly description?: string;
  /** Estimated effort in minutes. */
  readonly duration: number;
  /** Optional due date as YYYY-MM-DD. */
  readonly due?: string;
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly status: 'Pending' | 'Scheduled' | 'In Progress' | 'Completed';
  /** Unix epoch ms. Set at creation time. */
  readonly createdAt: number;
  /** Unix epoch ms. Only present when status is 'Completed'. */
  readonly completedAt?: number;
  /** YYYY-MM-DD. Only present when the task is scheduled. */
  readonly scheduledDate?: string;
  /** ISO 8601 UTC datetime. Only present when the task is scheduled. */
  readonly startTime?: string;
  /** ISO 8601 UTC datetime. Only present when the task is scheduled. */
  readonly endTime?: string;
  /** Explicitly 1 or absent — both treated as v1. */
  readonly schemaVersion?: 1;
}
