import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '@/src/types';
import { addDays, getLocalToday } from '@/src/utils/date-utils';
import { getWorkHours } from '@/src/utils/settings';
import { DayColumn } from './ThreeDayViewColumn';

interface ThreeDayViewProps {
  tasks: Task[];
  centerDate: string; // YYYY-MM-DD, the middle day
  onCompleteTask: (taskId: string) => void | Promise<void>;
  onStartTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onResizeTask: (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => void;
  onDeleteTask: (taskId: string) => void;
}

export const ThreeDayView: React.FC<ThreeDayViewProps> = ({
  tasks,
  centerDate,
  onCompleteTask,
  onStartTask,
  onEditTask,
  onResizeTask,
  onDeleteTask,
}) => {
  const [center, setCenter] = useState(centerDate);
  const workHours = getWorkHours();
  const today = getLocalToday();
  const currentHour = new Date().getHours();

  const dates = [addDays(center, -1), center, addDays(center, 1)];

  const slots: Array<{ hour: number; minute: number; label: string }> = [];
  for (let h = workHours.start; h < workHours.end; h++) {
    for (let m = 0; m < 60; m += 15) {
      const label = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      slots.push({ hour: h, minute: m, label });
    }
  }

  const getTasksForDate = (date: string): Task[] =>
    tasks.filter(
      (t) =>
        t.scheduledDate === date &&
        t.startTime &&
        t.endTime &&
        (t.status === 'Scheduled' || t.status === 'In Progress' ||
          (t.status === 'Completed' && t.deviationMinutes !== undefined))
    );

  return (
    <section className="flex-1 flex flex-col bg-surface-container-low rounded-2xl overflow-hidden border border-white/50">
      {/* Header */}
      <div className="px-4 py-3 bg-white flex items-center justify-between border-b border-outline-variant/20">
        <button
          onClick={() => setCenter(addDays(center, -1))}
          aria-label="Previous day"
          className="p-1.5 hover:bg-surface-container rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold font-headline text-on-surface">3-Day View</h2>
          {!dates.includes(today) && (
            <button
              onClick={() => setCenter(today)}
              className="px-2.5 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setCenter(addDays(center, 1))}
          aria-label="Next day"
          className="p-1.5 hover:bg-surface-container rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Timeline grid: time gutter + 3 day columns */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full">
          {/* Time gutter spacer — labels are rendered inside each DaySlot */}
          <div className="w-16 shrink-0" />
          {dates.map((date, idx) => (
            <DayColumn
              key={date}
              date={date}
              slots={slots}
              tasks={getTasksForDate(date)}
              isToday={date === today}
              currentHour={currentHour}
              workStart={workHours.start}
              showTimeLabels={idx === 0}
              onCompleteTask={onCompleteTask}
              onStartTask={onStartTask}
              onEditTask={onEditTask}
              onResizeTask={onResizeTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
