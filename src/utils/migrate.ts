/**
 * Schema migration for Firestore task documents.
 * Versioned: each doc has schemaVersion. Reader dispatches by version.
 * v1 (legacy): free-text dates, string duration, 3-state status
 * v2 (current): ISO dates, numeric duration, 4-state status, schedule fields
 */

import { Task, LegacyTask, SCHEMA_VERSION } from '../types/task.types';
import { parseDuration, getLocalToday } from './date-utils';

/** Migrate a raw Firestore document to the current Task schema */
export function migrateTask(raw: Record<string, unknown>): Task {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;

  if (version >= SCHEMA_VERSION) {
    return raw as unknown as Task;
  }

  // v1 → v2
  if (version === 1) {
    return migrateV1toV2(raw as unknown as LegacyTask);
  }

  // Unknown version, return as-is with current version
  return { ...raw, schemaVersion: SCHEMA_VERSION } as unknown as Task;
}

function migrateV1toV2(legacy: LegacyTask): Task {
  return {
    id: legacy.id,
    uid: legacy.uid,
    title: legacy.title,
    description: legacy.description,
    duration: parseDuration(legacy.duration),
    due: migrateDueDate(legacy.due),
    priority: legacy.priority,
    status: migrateStatus(legacy.status),
    createdAt: legacy.createdAt,
    schemaVersion: SCHEMA_VERSION,
    // Legacy startTime/endTime are display strings like "09:00 AM"
    // We can't convert these to UTC without knowing the original date,
    // so we drop them. Tasks will appear as Pending after migration.
    startTime: undefined,
    endTime: undefined,
    scheduledDate: undefined,
  };
}

/** Convert legacy free-text due dates to YYYY-MM-DD */
function migrateDueDate(due: string): string {
  if (!due) return getLocalToday();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return due;

  // "Today"
  if (due.toLowerCase() === 'today') return getLocalToday();

  // Try parsing common formats: "Oct 24, 4:00 PM", "Oct 25, 11:00 AM"
  try {
    const parsed = new Date(due);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      // If year is unreasonable (Date parsed "Oct 24" as current year), use current year
      const year = y < 2020 ? new Date().getFullYear() : y;
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${m}-${d}`;
    }
  } catch {
    // Fall through
  }

  return getLocalToday();
}

/** Map legacy 3-state status to 4-state. Legacy "In Progress" without schedule → Pending */
function migrateStatus(status: string): Task['status'] {
  switch (status) {
    case 'Completed':
      return 'Completed';
    case 'In Progress':
      // Without valid startTime/endTime, can't be truly scheduled
      return 'Pending';
    case 'Pending':
    default:
      return 'Pending';
  }
}
