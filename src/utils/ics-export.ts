import type { TaskViewModel } from '../services/task-view-model';

/**
 * Generate an ICS (iCalendar) string from scheduled tasks.
 * Only includes tasks that have both startTime and endTime.
 */
export function generateICS(tasks: readonly TaskViewModel[]): string {
  const scheduled = tasks.filter((t) => t.startTime && t.endTime);
  if (scheduled.length === 0) return '';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planova//Task Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const task of scheduled) {
    const uid = `${task.id}@planova`;
    const dtstart = toICSDate(task.startTime!);
    const dtend = toICSDate(task.endTime!);
    const summary = escapeICS(task.title);
    const description = task.description ? escapeICS(task.description) : '';
    const categories = task.group ? escapeICS(task.group) : '';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    if (categories) lines.push(`CATEGORIES:${categories}`);
    lines.push(`STATUS:${task.status === 'Completed' ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push(`PRIORITY:${task.priority === 'High' ? 1 : task.priority === 'Medium' ? 5 : 9}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Convert ISO 8601 UTC string to ICS date format (YYYYMMDDTHHMMSSZ). */
function toICSDate(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape special characters for ICS text fields. */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
