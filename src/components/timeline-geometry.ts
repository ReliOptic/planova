import type { Task } from '@/src/types';

/** Column layout for a single task within its overlap group. */
export interface TaskColumnInfo {
  readonly column: number;
  readonly totalColumns: number;
}

/**
 * computeColumns — assigns column positions to overlapping scheduled tasks.
 *
 * Tasks that overlap in time are grouped, then spread across equal-width columns
 * so they render side-by-side without occlusion.
 *
 * @param tasks - Scheduled tasks that have both startTime and endTime set.
 * @returns Map from task id to its column layout info.
 */
export function computeColumns(tasks: Task[]): Map<string, TaskColumnInfo> {
  const result = new Map<string, TaskColumnInfo>();
  if (tasks.length === 0) return result;

  const sorted = [...tasks].sort(
    (a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime(),
  );

  const groups: Task[][] = [];
  let currentGroup: Task[] = [sorted[0]];
  let groupEnd = new Date(sorted[0].endTime!).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const taskStart = new Date(sorted[i].startTime!).getTime();
    if (taskStart < groupEnd) {
      currentGroup.push(sorted[i]);
      groupEnd = Math.max(groupEnd, new Date(sorted[i].endTime!).getTime());
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      groupEnd = new Date(sorted[i].endTime!).getTime();
    }
  }
  groups.push(currentGroup);

  for (const group of groups) {
    const totalColumns = group.length;
    group.forEach((task, index) => {
      result.set(task.id, { column: index, totalColumns });
    });
  }

  return result;
}
