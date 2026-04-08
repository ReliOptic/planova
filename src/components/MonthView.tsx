import React, { useMemo } from 'react';
import { Task } from '@/src/types';
import { addDays, getLocalToday, formatLocalDate } from '@/src/utils/date-utils';
import { cn } from '@/src/lib/utils';

interface MonthViewProps {
  tasks: Task[];
  centerDate: string; // YYYY-MM-DD - show the month containing this date
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const PRIORITY_CHIP: Record<string, string> = {
  High: 'bg-tertiary-container text-white',
  Medium: 'bg-secondary-container text-on-secondary-container',
  Low: 'bg-surface-container-highest text-on-secondary-container',
};

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_CHIPS = 3;

/** Return the Monday on or before a given date */
function startOfWeekMonday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun … 6=Sat
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + offsetToMonday);
  return formatLocalDate(date);
}

/** Build a flat array of YYYY-MM-DD strings for a 5-or-6-row month grid */
function buildMonthGrid(centerDate: string): string[] {
  const [y, m] = centerDate.split('-').map(Number);
  const firstOfMonth = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  const gridStart = startOfWeekMonday(firstOfMonth);

  // Determine rows needed: keep going until we've covered the last day of the month
  const lastOfMonth = new Date(y, m, 0); // day 0 of next month = last day of this month
  const lastDateStr = formatLocalDate(lastOfMonth);

  const days: string[] = [];
  let cursor = gridStart;
  while (true) {
    days.push(cursor);
    // Stop after we've included the last day of the month AND completed the week
    if (days.length % 7 === 0 && cursor >= lastDateStr) break;
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Collect tasks for a given day */
function getTasksForDay(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => {
    if (t.scheduledDate === day) return true;
    if (t.status === 'Pending' && t.due === day && !t.scheduledDate) return true;
    return false;
  });
}

export const MonthView: React.FC<MonthViewProps> = ({
  tasks,
  centerDate,
  onEditTask,
  onDeleteTask,
}) => {
  const today = getLocalToday();
  const [cy, cm] = centerDate.split('-').map(Number);

  const days = useMemo(() => buildMonthGrid(centerDate), [centerDate]);

  return (
    <section className="flex-1 flex flex-col bg-surface-container-low rounded-2xl overflow-hidden border border-white/50">
      {/* Day-of-week header row */}
      <div className="grid grid-cols-7 border-b border-outline-variant/10">
        {DAY_HEADERS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const [dayY, dayM] = day.split('-').map(Number);
          const isCurrentMonth = dayY === cy && dayM === cm;
          const isToday = day === today;
          const dayTasks = getTasksForDay(tasks, day);
          const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_CHIPS);
          const overflow = dayTasks.length - MAX_VISIBLE_CHIPS;

          return (
            <div
              key={day}
              className={cn(
                'min-h-[100px] p-1.5 border-b border-r border-outline-variant/10 flex flex-col gap-1',
                !isCurrentMonth && 'opacity-40'
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-start mb-0.5">
                <span
                  className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full leading-none',
                    isToday
                      ? 'bg-primary text-white font-bold'
                      : 'text-on-surface-variant'
                  )}
                >
                  {parseInt(day.split('-')[2], 10)}
                </span>
              </div>

              {/* Task chips */}
              {visibleTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDeleteTask(task.id);
                  }}
                  title={task.title}
                  className={cn(
                    'w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded truncate leading-4',
                    PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.Low,
                    'hover:brightness-95 transition-all'
                  )}
                >
                  {task.title}
                </button>
              ))}

              {/* Overflow indicator */}
              {overflow > 0 && (
                <span className="text-[10px] text-on-surface-variant/60 font-medium px-1">
                  +{overflow} more
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
