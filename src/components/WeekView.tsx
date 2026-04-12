import React from 'react';
import { Task } from '@/src/types';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/src/lib/utils';
import { computePosition, computeBlockHeight, formatTimeDisplay, isPastTime, addDays, getLocalToday } from '@/src/utils/date-utils';
import { getWorkHours } from '@/src/utils/settings';
import { getWeekStart, buildWeekSlots, DAY_LABELS } from './week-view-helpers';
import type { SlotDescriptor } from './week-view-helpers';

const SLOT_HEIGHT_PX = 80;

/** Props for WeekView. */
export interface WeekViewProps {
  tasks: Task[];
  centerDate: string;
  onCompleteTask: (taskId: string) => void | Promise<void>;
  onStartTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onResizeTask: (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => void;
  onDeleteTask: (taskId: string) => void;
}

interface WeekDaySlotProps {
  date: string;
  hour: number;
  minute: number;
  isHourStart: boolean;
}

const WeekDaySlot: React.FC<WeekDaySlotProps> = ({ date, hour, minute, isHourStart }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${date}-${hour}-${minute}`,
    data: { hour, minute, selectedDate: date },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-5 transition-colors cursor-cell relative',
        isOver ? 'bg-primary/5' : 'hover:bg-white/40',
        isHourStart && 'border-t border-outline-variant/30',
        minute === 30 && 'border-t border-dashed border-outline-variant/15',
      )}
    >
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded m-0.5 pointer-events-none" />
      )}
    </div>
  );
};

interface WeekTaskBlockProps {
  task: Task;
  topPx: number;
  heightPx: number;
  onEdit: () => void;
  onComplete: () => void | Promise<void>;
  onDelete: () => void;
}

const WeekTaskBlock: React.FC<WeekTaskBlockProps> = ({ task, topPx, heightPx, onEdit, onComplete, onDelete }) => {
  const isOverdue =
    task.status === 'Scheduled' && task.endTime !== undefined && isPastTime(task.endTime);
  const statusColors = isOverdue
    ? 'bg-tertiary-container/10 border-tertiary'
    : task.status === 'In Progress'
      ? 'bg-primary/10 border-primary'
      : 'bg-secondary-container/30 border-on-secondary-container';
  return (
    <div
      style={{ top: `${topPx}px`, height: `${Math.max(heightPx, 18)}px`, left: 0, right: 0, zIndex: 10 }}
      onDoubleClick={onEdit}
      className={cn('absolute px-1 py-0.5 group rounded border-l-2 overflow-hidden cursor-pointer', statusColors)}
    >
      <p className={cn('text-[10px] font-bold truncate leading-tight',
        isOverdue ? 'text-tertiary' : task.status === 'In Progress' ? 'text-primary' : 'text-on-secondary-container'
      )}>
        {task.title}
      </p>
      {task.startTime && task.endTime && heightPx > 28 && (
        <p className="text-[9px] text-on-surface-variant/60 truncate">{formatTimeDisplay(task.startTime)}</p>
      )}
      <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
        <button onClick={(e) => { e.stopPropagation(); onComplete(); }}
          className="w-3.5 h-3.5 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-all flex items-center justify-center" title="Complete">
          <span className="text-[8px] leading-none">✓</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-3.5 h-3.5 bg-tertiary/10 rounded-full text-tertiary hover:bg-tertiary/20 transition-all flex items-center justify-center" title="Delete">
          <span className="text-[8px] leading-none">✕</span>
        </button>
      </div>
    </div>
  );
};

interface WeekDayColumnProps {
  date: string;
  tasks: Task[];
  slots: SlotDescriptor[];
  onEditTask: (task: Task) => void;
  onCompleteTask: (taskId: string) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void;
  workStartHour: number;
}

const WeekDayColumn: React.FC<WeekDayColumnProps> = ({ date, tasks, slots, onEditTask, onCompleteTask, onDeleteTask, workStartHour }) => (
  <div className="relative border-l border-outline-variant/20">
    {slots.map((s) => (
      <WeekDaySlot key={`${s.hour}-${s.minute}`} date={date} hour={s.hour} minute={s.minute} isHourStart={s.isHourStart} />
    ))}
    {tasks.map((task) => (
      <WeekTaskBlock
        key={task.id}
        task={task}
        topPx={computePosition(task.startTime!, workStartHour, SLOT_HEIGHT_PX)}
        heightPx={computeBlockHeight(task.blockDurationMinutes ?? task.duration, SLOT_HEIGHT_PX)}
        onEdit={() => onEditTask(task)}
        onComplete={() => onCompleteTask(task.id)}
        onDelete={() => onDeleteTask(task.id)}
      />
    ))}
  </div>
);

/**
 * WeekView — 7-day calendar grid with droppable slots and compact task blocks.
 */
export const WeekView: React.FC<WeekViewProps> = ({
  tasks, centerDate, onCompleteTask, onStartTask: _onStartTask, onEditTask, onResizeTask: _onResizeTask, onDeleteTask,
}) => {
  const workHours = getWorkHours();
  const today = getLocalToday();
  const weekStart = getWeekStart(centerDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const slots = buildWeekSlots(workHours.start, workHours.end);
  const totalHeight = (workHours.end - workHours.start) * SLOT_HEIGHT_PX;
  const hourLabelWidth = 48;

  return (
    <section className="flex-1 flex flex-col bg-surface-container-low rounded-2xl overflow-hidden border border-white/50">
      <div className="flex bg-white border-b border-outline-variant/20">
        <div style={{ width: hourLabelWidth }} className="shrink-0" />
        {weekDays.map((date, i) => {
          const [, , dayNum] = date.split('-').map(Number);
          const isToday = date === today;
          return (
            <div key={date} className={cn('flex-1 text-center py-3 border-l border-outline-variant/20', isToday && 'bg-primary/5')}>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wider', isToday ? 'text-primary' : 'text-on-surface-variant/60')}>
                {DAY_LABELS[i]}
              </span>
              <div className={cn('mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold',
                isToday ? 'bg-primary text-white' : 'text-on-surface')}>
                {dayNum}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ minHeight: `${totalHeight}px` }}>
          <div style={{ width: hourLabelWidth }} className="shrink-0 relative">
            {slots.filter((s) => s.isHourStart).map((s) => (
              <div key={s.hour} className="absolute right-2 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider"
                style={{ top: `${(s.hour - workHours.start) * SLOT_HEIGHT_PX}px` }}>
                {s.label}
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7">
            {weekDays.map((date) => (
              <WeekDayColumn
                key={date}
                date={date}
                tasks={tasks.filter((t) =>
                  t.scheduledDate === date && t.startTime && t.endTime &&
                  (t.status === 'Scheduled' || t.status === 'In Progress')
                )}
                slots={slots}
                onEditTask={onEditTask}
                onCompleteTask={onCompleteTask}
                onDeleteTask={onDeleteTask}
                workStartHour={workHours.start}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
