import React, { useState, useEffect } from 'react';
import { Task } from '@/src/types';
import {
  getLocalToday,
  computePosition,
  computeBlockHeight,
  getCurrentTimePosition,
} from '@/src/utils/date-utils';
import { getWorkHours } from '@/src/utils/settings';
import {
  SLOT_HEIGHT_PX,
  DroppableSlot,
  DraggableScheduledTask,
  computeColumns,
} from './TimelineShared';
import { ThreeDayView } from './ThreeDayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { TimelineHeader } from './timeline-header';
import type { ViewMode } from './timeline-header';

/** Props for Timeline. */
export interface TimelineProps {
  tasks: Task[];
  onCompleteTask: (taskId: string) => void | Promise<void>;
  onStartTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onResizeTask: (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => void;
  onDeleteTask: (taskId: string) => void;
}

/**
 * Timeline — multi-view calendar with day, 3-day, week, and month modes.
 */
export const Timeline: React.FC<TimelineProps> = ({
  tasks, onCompleteTask, onStartTask, onEditTask, onResizeTask, onDeleteTask,
}) => {
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [timeMarkerPx, setTimeMarkerPx] = useState(0);
  const workHours = getWorkHours();
  const isToday = selectedDate === getLocalToday();

  useEffect(() => {
    if (!isToday) return;
    const update = (): void => setTimeMarkerPx(getCurrentTimePosition(workHours.start, SLOT_HEIGHT_PX));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [isToday, workHours.start]);

  const currentHour = new Date().getHours();
  const slots: Array<{ hour: number; minute: number; label: string; isHourStart: boolean }> = [];
  for (let h = workHours.start; h < workHours.end; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = new Date(2000, 0, 1, h, m);
      const label = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      slots.push({ hour: h, minute: m, label, isHourStart: m === 0 });
    }
  }

  const scheduledTasks = tasks.filter(
    (t) => t.scheduledDate === selectedDate && t.startTime && t.endTime &&
      (t.status === 'Scheduled' || t.status === 'In Progress'),
  );
  const columns = computeColumns(scheduledTasks);
  const totalHeight = (workHours.end - workHours.start) * SLOT_HEIGHT_PX;

  return (
    <section className="flex-1 flex flex-col bg-surface-container-low rounded-2xl overflow-hidden border border-white/50 relative">
      <TimelineHeader
        selectedDate={selectedDate}
        viewMode={viewMode}
        onDateChange={setSelectedDate}
        onViewModeChange={setViewMode}
      />
      {viewMode === '3day' ? (
        <ThreeDayView tasks={tasks} centerDate={selectedDate} onCompleteTask={onCompleteTask}
          onStartTask={onStartTask} onEditTask={onEditTask} onResizeTask={onResizeTask} onDeleteTask={onDeleteTask} />
      ) : viewMode === 'week' ? (
        <WeekView tasks={tasks} centerDate={selectedDate} onCompleteTask={onCompleteTask}
          onStartTask={onStartTask} onEditTask={onEditTask} onResizeTask={onResizeTask} onDeleteTask={onDeleteTask} />
      ) : viewMode === 'month' ? (
        <MonthView tasks={tasks} centerDate={selectedDate} onEditTask={onEditTask} onDeleteTask={onDeleteTask} />
      ) : (
        <div className="flex-1 overflow-y-auto relative" style={{ minHeight: `${totalHeight}px` }}>
          {isToday && timeMarkerPx > 0 && timeMarkerPx < totalHeight && (
            <div className="absolute left-20 right-0 flex items-center z-20 pointer-events-none"
              style={{ top: `${timeMarkerPx}px` }}>
              <div className="w-2.5 h-2.5 bg-tertiary rounded-full -ml-1.5" />
              <div className="flex-1 h-[2px] bg-tertiary opacity-60" />
            </div>
          )}
          {scheduledTasks.map((task) => {
            const colInfo = columns.get(task.id) ?? { column: 0, totalColumns: 1 };
            return (
              <DraggableScheduledTask
                key={task.id}
                task={task}
                topPx={computePosition(task.startTime!, workHours.start, SLOT_HEIGHT_PX)}
                heightPx={computeBlockHeight(task.blockDurationMinutes ?? task.duration, SLOT_HEIGHT_PX)}
                workStartHour={workHours.start}
                column={colInfo.column}
                totalColumns={colInfo.totalColumns}
                onComplete={() => onCompleteTask(task.id)}
                onStart={() => onStartTask(task.id)}
                onEdit={() => onEditTask(task)}
                onResize={onResizeTask}
                onDelete={() => onDeleteTask(task.id)}
              />
            );
          })}
          <div className="ml-20">
            {slots.map((slot) => (
              <DroppableSlot
                key={`${slot.hour}-${slot.minute}`}
                hour={slot.hour}
                minute={slot.minute}
                label={slot.label}
                isHourStart={slot.isHourStart}
                selectedDate={selectedDate}
                isCurrentHour={isToday && slot.hour === currentHour}
              />
            ))}
          </div>
          {scheduledTasks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-on-surface-variant/40">
                <p className="text-sm font-medium">No tasks scheduled</p>
                <p className="text-[10px] mt-1">Drag a task from the backlog to plan your day</p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
