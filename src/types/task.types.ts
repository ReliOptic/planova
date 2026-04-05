export type Priority = 'High' | 'Medium' | 'Low';

export type TaskStatus = 'Pending' | 'Scheduled' | 'In Progress' | 'Completed';

export const SCHEMA_VERSION = 2;

/**
 * Task: a backlog item. Owns identity, title, priority, duration.
 * Schedule fields (startTime, endTime) live on the same Firestore doc
 * for Phase 1 (1:1 relationship, avoids N+1 queries).
 * Phase 3 will add ExternalCalendarEvent as a separate collection.
 */
export interface Task {
  readonly id: string;
  readonly uid: string;
  readonly title: string;
  readonly description?: string;
  readonly duration: number; // minutes
  readonly due: string; // YYYY-MM-DD (date-only, no timezone)
  readonly priority: Priority;
  readonly status: TaskStatus;
  readonly createdAt: number; // Date.now()
  readonly completedAt?: number; // Date.now() when completed
  readonly schemaVersion: number;
  // Schedule fields (ScheduleBlock projection, Phase 1)
  readonly startTime?: string; // UTC ISO 8601 (e.g. "2026-04-05T01:00:00.000Z")
  readonly endTime?: string; // UTC ISO 8601
  readonly scheduledDate?: string; // YYYY-MM-DD for date-based queries
}

/**
 * ScheduleBlock: a time allocation on the timeline.
 * Phase 1: projected from Task fields (startTime, endTime, scheduledDate).
 * Phase 3+: may become its own Firestore collection for multi-block tasks.
 */
export interface ScheduleBlock {
  readonly taskId: string;
  readonly uid: string;
  readonly title: string;
  readonly priority: Priority;
  readonly duration: number;
  readonly startTime: string; // UTC ISO 8601
  readonly endTime: string; // UTC ISO 8601
  readonly scheduledDate: string; // YYYY-MM-DD
  readonly status: TaskStatus;
}

/**
 * ExternalCalendarEvent: read-only GCal event block (Phase 3).
 * Type defined now for forward compatibility.
 */
export interface ExternalCalendarEvent {
  readonly id: string;
  readonly uid: string;
  readonly gcalEventId: string;
  readonly title: string;
  readonly startTime: string; // UTC ISO 8601
  readonly endTime: string; // UTC ISO 8601
  readonly scheduledDate: string; // YYYY-MM-DD
  readonly isReadOnly: true;
  readonly lastSynced: number;
}

/** Project a Task's schedule fields into a ScheduleBlock */
export function toScheduleBlock(task: Task): ScheduleBlock | null {
  if (!task.startTime || !task.endTime || !task.scheduledDate) {
    return null;
  }
  return {
    taskId: task.id,
    uid: task.uid,
    title: task.title,
    priority: task.priority,
    duration: task.duration,
    startTime: task.startTime,
    endTime: task.endTime,
    scheduledDate: task.scheduledDate,
    status: task.status,
  };
}

/** Schema v1 (legacy) task shape for migration */
export interface LegacyTask {
  readonly id: string;
  readonly uid: string;
  readonly title: string;
  readonly description?: string;
  readonly duration: string; // free-text like "2h 30m"
  readonly due: string; // free-text like "Today" or "Oct 24, 4:00 PM"
  readonly priority: Priority;
  readonly status: 'Pending' | 'In Progress' | 'Completed';
  readonly progress?: number;
  readonly startTime?: string; // display string like "09:00 AM"
  readonly endTime?: string; // display string like "11:00 AM"
  readonly createdAt: number;
}
