import React, { useState } from 'react';
import { GripVertical, Check, Trash2 } from 'lucide-react';
import { Task } from '@/src/types';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/src/lib/utils';
import { computePosition, computeBlockHeight, formatTimeDisplay, isPastTime } from '@/src/utils/date-utils';

const SLOT_HEIGHT_PX = 80;

const DaySlot: React.FC<{
  hour: number;
  minute: number;
  label: string;
  date: string;
  isCurrentHour: boolean;
  showTimeLabel?: boolean;
}> = ({ hour, minute, label, date, isCurrentHour, showTimeLabel = false }) => {
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
        isCurrentHour && 'bg-primary/[0.03]',
        minute === 0 && 'border-t border-outline-variant/30',
        minute === 30 && 'border-t border-dashed border-outline-variant/15'
      )}
    >
      {isOver && <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded m-0.5 pointer-events-none" />}
      {minute === 0 && showTimeLabel && (
        <span className="absolute -left-16 w-14 text-right text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-widest pt-0.5">
          {label}
        </span>
      )}
    </div>
  );
};

const TaskBlock: React.FC<{
  task: Task;
  topPx: number;
  heightPx: number;
  onComplete: () => void | Promise<void>;
  onStart: () => void;
  onEdit: () => void;
  onResize: (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => void;
  onDelete: () => void;
}> = ({ task, topPx, heightPx, onComplete, onStart, onEdit, onResize, onDelete }) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: task });

  const isOverdue = task.status === 'Scheduled' && task.endTime !== undefined && isPastTime(task.endTime);
  const statusColors = isOverdue
    ? 'bg-tertiary-container/10 border-tertiary'
    : task.status === 'In Progress'
      ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
      : 'bg-secondary-container/30 border-on-secondary-container';

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleting) return;
    setIsCompleting(true);
    try { await onComplete(); } catch { setIsCompleting(false); }
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const isTouch = 'touches' in e;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const slotPx = SLOT_HEIGHT_PX / 4;
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
    const finish = (endY: number) => {
      const delta = Math.round((endY - startY) / slotPx);
      if (delta !== 0) onResize(task.id, edge, delta);
      setIsResizing(false);
      cleanup();
    };
    const onMove = (ev: MouseEvent) => ev.preventDefault();
    const onEnd = (ev: MouseEvent) => finish(ev.clientY);
    const onTouchMove = (ev: TouchEvent) => ev.preventDefault();
    const onTouchEnd = (ev: TouchEvent) => finish(ev.changedTouches[0].clientY);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: isResizing ? undefined : CSS.Translate.toString(transform), top: `${topPx}px`, height: `${Math.max(heightPx, 24)}px`, opacity: isDragging ? 0.5 : 1, zIndex: isDragging || isResizing ? 100 : 10, left: 0, right: 4 }}
      {...attributes}
      onDoubleClick={onEdit}
      className={cn('absolute p-2 group rounded-lg border-l-4 transition-all overflow-hidden', statusColors, isDragging && 'shadow-2xl ring-2 ring-primary/30')}
    >
      <div onMouseDown={(e) => handleResizeStart(e, 'top')} onTouchStart={(e) => handleResizeStart(e, 'top')} className="absolute top-0 left-0 right-0 h-2 cursor-n-resize opacity-0 group-hover:opacity-100 hover:bg-primary/10 z-20" />
      <div className="flex justify-between items-start gap-1">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div {...listeners} className="p-0.5 hover:bg-surface-container rounded cursor-grab active:cursor-grabbing shrink-0">
            <GripVertical className="text-outline-variant group-hover:text-primary" size={12} />
          </div>
          <h4 className={cn('text-xs font-bold font-headline truncate', isOverdue ? 'text-tertiary' : task.status === 'In Progress' ? 'text-primary' : 'text-on-secondary-container')}>
            {task.title}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.startTime && task.endTime && (
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded hidden sm:block', task.status === 'In Progress' ? 'bg-primary text-white' : isOverdue ? 'bg-tertiary text-white' : 'bg-on-secondary-container text-white')}>
              {formatTimeDisplay(task.startTime)}
            </span>
          )}
          {task.status === 'Scheduled' && !isOverdue && (
            <button onClick={(e) => { e.stopPropagation(); onStart(); }} className="p-0.5 bg-primary/10 rounded-full text-primary hover:bg-primary/20 opacity-0 group-hover:opacity-100" title="Start">
              <Check size={10} />
            </button>
          )}
          {(task.status === 'In Progress' || isOverdue) && (
            <button onClick={handleComplete} disabled={isCompleting} className={cn('p-0.5 rounded-full', isCompleting ? 'bg-green-500 text-white' : 'bg-white/80 text-primary hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100')} title="Complete">
              <Check size={10} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 text-on-surface-variant hover:text-tertiary opacity-0 group-hover:opacity-100" title="Delete">
            <Trash2 size={10} />
          </button>
        </div>
      </div>
      <div onMouseDown={(e) => handleResizeStart(e, 'bottom')} onTouchStart={(e) => handleResizeStart(e, 'bottom')} className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 hover:bg-primary/10 z-20" />
    </div>
  );
};

export interface DayColumnProps {
  date: string;
  slots: ReadonlyArray<{ hour: number; minute: number; label: string }>;
  tasks: Task[];
  isToday: boolean;
  currentHour: number;
  workStart: number;
  showTimeLabels?: boolean;
  onCompleteTask: (id: string) => void | Promise<void>;
  onStartTask: (id: string) => void;
  onEditTask: (t: Task) => void;
  onResizeTask: (id: string, edge: 'top' | 'bottom', delta: number) => void;
  onDeleteTask: (id: string) => void;
}

export const DayColumn: React.FC<DayColumnProps> = ({
  date, slots, tasks, isToday, currentHour, workStart, showTimeLabels = false,
  onCompleteTask, onStartTask, onEditTask, onResizeTask, onDeleteTask,
}) => {
  const [y, m, d] = date.split('-').map(Number);
  const dayName = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <div className="flex-1 flex flex-col min-w-0 border-l border-outline-variant/20 first:border-l-0">
      <div className={cn('py-3 text-center border-b border-outline-variant/20', isToday && 'bg-primary/5')}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70">{dayName}</p>
        <p className={cn('text-2xl font-bold font-headline', isToday ? 'text-primary' : 'text-on-surface')}>{d}</p>
      </div>
      <div className="flex-1 relative">
        {slots.map((slot) => (
          <DaySlot key={`${slot.hour}-${slot.minute}`} hour={slot.hour} minute={slot.minute} label={slot.label} date={date} isCurrentHour={isToday && slot.hour === currentHour} showTimeLabel={showTimeLabels} />
        ))}
        {tasks.map((task) => (
          <TaskBlock
            key={task.id}
            task={task}
            topPx={computePosition(task.startTime!, workStart, SLOT_HEIGHT_PX)}
            heightPx={computeBlockHeight(task.duration, SLOT_HEIGHT_PX)}
            onComplete={() => onCompleteTask(task.id)}
            onStart={() => onStartTask(task.id)}
            onEdit={() => onEditTask(task)}
            onResize={onResizeTask}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[10px] text-on-surface-variant/30 font-medium">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};
