// Re-export domain types used across the application.
// The UI layer works with TaskViewModel (v2 domain Task + schedule projection).
// Named as `Task` here for backward compatibility with all UI components.
export type { Priority, TaskStatus, TaskColor } from './domain/task';
export type { RecurrenceRule, RecurrenceFrequency } from './domain/recurrence-rule';
export type { TaskViewModel as Task } from './services/task-view-model';
export { SCHEMA_VERSION } from './types/task.types';

// Legacy alias for gradual migration
export type Status = import('./domain/task').TaskStatus;

export interface WeeklyVelocity {
  day: string;
  done: number;
  remaining: number;
}
