// Re-export from new location. All types live in src/types/task.types.ts now.
export {
  type Priority,
  type TaskStatus,
  type Task,
  type ScheduleBlock,
  type ExternalCalendarEvent,
  type LegacyTask,
  toScheduleBlock,
  SCHEMA_VERSION,
} from './types/task.types';

// Legacy alias for gradual migration
export type Status = import('./types/task.types').TaskStatus;

export interface WeeklyVelocity {
  day: string;
  done: number;
  remaining: number;
}
