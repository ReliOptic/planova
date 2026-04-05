import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Check, Trash2 } from 'lucide-react';
import { Task } from '@/src/types';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import {
  getLocalToday,
  formatDateHeadline,
  addDays,
  computePosition,
  computeBlockHeight,
  formatTimeDisplay,
  getCurrentTimePosition,
  isPastTime,
  buildUTCTime,
} from '@/src/utils/date-utils';
import { getWorkHours } from '@/src/utils/settings';

const SLOT_HEIGHT_PX = 80;

interface TimelineProps {
  tasks: Task[];
  onCompleteTask: (taskId: string) => void | Promise<void>;
  onStartTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onResizeTask: (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => void;
  onDeleteTask: (taskId: string) => void;
}

// 15-min droppable slot
const DroppableSlot: React.FC<{
  hour: number;
  minute: number;
  label: string;
  isHourStart: boolean;
  selectedDate: string;
  isCurrentHour?: boolean;
}> = ({ hour, minute, label, isHourStart, selectedDate, isCurrentHour }) => {
  const slotId = `slot-${hour}-${minute}`;
  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: { hour, minute, selectedDate },
  });

  const isHalfHour = minute === 30;
  const isQuarterHour = minute === 15 || minute === 45;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-5 transition-colors cursor-cell relative group',
        isOver ? 'bg-primary/5' : 'hover:bg-white/40',
        isCurrentHour && 'bg-primary/[0.03]',
        isHourStart && 'border-t border-outline-variant/30',
        isHalfHour && 'border-t border-dashed border-outline-variant/15',
        isQuarterHour && 'border-t-0'
      )}
    >
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded m-0.5 pointer-events-none" />
      )}
      {/* Show label only on hour boundaries */}
      {isHourStart && (
        <span className="absolute -left-20 w-18 text-right text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-widest pt-0.5">
          {label}
        </span>
      )}
    </div>
  );
};

// Draggable task block on the timeline with resize handles
const DraggableScheduledTask: React.FC<{
  task: Task;
  topPx: number;
  heightPx: number;
  workStartHour: number;
  column: number;
  totalColumns: number;
  onComplete: () => void | Promise<void>;
  onStart: () => void;
  onEdit: () => void;
  onResize: (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => void;
  onDelete: () => void;
}> = ({ task, topPx, heightPx, workStartHour, column, totalColumns, onComplete, onStart, onEdit, onResize, onDelete }) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const isOverdue =
    task.status === 'Scheduled' &&
    task.endTime !== undefined &&
    isPastTime(task.endTime);

  // Column-based positioning: left-24 (96px) is the time-label gutter, right-4 (16px) is the right margin
  const leftBase = 96;
  const rightGap = 16;
  const colWidth =
    totalColumns > 1
      ? `calc((100% - ${leftBase + rightGap}px) / ${totalColumns} - 4px)`
      : `calc(100% - ${leftBase + rightGap}px)`;
  const colLeft =
    totalColumns > 1
      ? `calc(${leftBase}px + ${column} * (100% - ${leftBase + rightGap}px) / ${totalColumns})`
      : `${leftBase}px`;

  const style: React.CSSProperties = {
    transform: isResizing ? undefined : CSS.Translate.toString(transform),
    top: `${topPx}px`,
    height: `${Math.max(heightPx, 24)}px`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging || isResizing ? 100 : 10,
    left: colLeft,
    width: colWidth,
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await onComplete();
    } catch {
      setIsCompleting(false);
    }
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStart();
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const isTouch = 'touches' in e;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const slotPx = SLOT_HEIGHT_PX / 4; // 20px per 15-min slot

    const cleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    const finish = (endY: number) => {
      const deltaY = endY - startY;
      const deltaSlots = Math.round(deltaY / slotPx);
      if (deltaSlots !== 0) {
        onResize(task.id, edge, deltaSlots);
      }
      setIsResizing(false);
      cleanup();
    };

    const onMove = (ev: MouseEvent) => { ev.preventDefault(); };
    const onEnd = (ev: MouseEvent) => finish(ev.clientY);
    const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); };
    const onTouchEnd = (ev: TouchEvent) => finish(ev.changedTouches[0].clientY);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  };

  const statusColors = isOverdue
    ? 'bg-tertiary-container/10 border-tertiary'
    : task.status === 'In Progress'
      ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
      : 'bg-secondary-container/30 border-on-secondary-container';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onDoubleClick={onEdit}
      className={cn(
        'absolute p-3 group rounded-lg border-l-4 transition-all overflow-hidden',
        statusColors,
        isDragging && 'shadow-2xl ring-2 ring-primary/30'
      )}
    >
      {/* Top resize handle */}
      <div
        onMouseDown={(e) => handleResizeStart(e, 'top')}
        onTouchStart={(e) => handleResizeStart(e, 'top')}
        className="absolute top-0 left-0 right-0 h-2 cursor-n-resize opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity z-20"
      />

      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            {...listeners}
            className="p-1 hover:bg-surface-container rounded cursor-grab active:cursor-grabbing shrink-0"
          >
            <GripVertical className="text-outline-variant group-hover:text-primary transition-colors" size={14} />
          </div>
          <h4
            className={cn(
              'text-sm font-bold font-headline truncate',
              isOverdue
                ? 'text-tertiary'
                : task.status === 'In Progress'
                  ? 'text-primary'
                  : 'text-on-secondary-container'
            )}
          >
            {task.title}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.startTime && task.endTime && (
            <span
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded shadow-sm',
                task.status === 'In Progress'
                  ? 'bg-primary text-white'
                  : isOverdue
                    ? 'bg-tertiary text-white'
                    : 'bg-on-secondary-container text-white'
              )}
            >
              {formatTimeDisplay(task.startTime)} - {formatTimeDisplay(task.endTime)}
            </span>
          )}
          {isOverdue && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-tertiary/10 text-tertiary">
              OVERDUE
            </span>
          )}
          {task.status === 'In Progress' && (
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
          {task.status === 'Scheduled' && !isOverdue && (
            <button
              onClick={handleStart}
              className="p-1 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-all opacity-0 group-hover:opacity-100"
              title="Start task"
            >
              <Check size={12} />
            </button>
          )}
          {(task.status === 'In Progress' || isOverdue) && (
            <motion.button
              onClick={handleComplete}
              disabled={isCompleting}
              animate={isCompleting ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3, type: 'spring' }}
              className={cn(
                'p-1 rounded-full transition-all',
                isCompleting
                  ? 'bg-green-500 text-white'
                  : 'bg-white/80 text-primary hover:bg-primary hover:text-white shadow-sm opacity-0 group-hover:opacity-100'
              )}
              title="Mark complete"
            >
              <Check size={12} />
            </motion.button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 text-on-surface-variant hover:text-tertiary transition-colors opacity-0 group-hover:opacity-100"
            title="Delete task"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {task.description && heightPx > 48 && (
        <p
          className={cn(
            'text-[11px] mt-1 ml-8 truncate',
            task.status === 'In Progress' ? 'text-primary/80' : 'text-on-secondary-container/80'
          )}
        >
          {task.description}
        </p>
      )}

      {/* Bottom resize handle */}
      <div
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        onTouchStart={(e) => handleResizeStart(e, 'bottom')}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity z-20"
      />
    </div>
  );
};

export const Timeline: React.FC<TimelineProps> = ({ tasks, onCompleteTask, onStartTask, onEditTask, onResizeTask, onDeleteTask }) => {
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [timeMarkerPx, setTimeMarkerPx] = useState(0);
  const workHours = getWorkHours();
  const isToday = selectedDate === getLocalToday();

  // Update time marker every 60s
  useEffect(() => {
    if (!isToday) return;
    const update = () => setTimeMarkerPx(getCurrentTimePosition(workHours.start, SLOT_HEIGHT_PX));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [isToday, workHours.start]);

  const currentHour = new Date().getHours();

  // Generate 15-min slots
  const slots: Array<{ hour: number; minute: number; label: string; isHourStart: boolean }> = [];
  for (let h = workHours.start; h < workHours.end; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = new Date(2000, 0, 1, h, m);
      const label = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      slots.push({ hour: h, minute: m, label, isHourStart: m === 0 });
    }
  }

  // Filter tasks for selected date that have schedule data
  const scheduledTasks = tasks.filter(
    (t) =>
      t.scheduledDate === selectedDate &&
      t.startTime &&
      t.endTime &&
      (t.status === 'Scheduled' || t.status === 'In Progress')
  );

  // Compute collision groups so overlapping tasks render side-by-side
  const computeColumns = (tasks: Task[]): Map<string, { column: number; totalColumns: number }> => {
    const result = new Map<string, { column: number; totalColumns: number }>();
    if (tasks.length === 0) return result;

    const sorted = [...tasks].sort(
      (a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime()
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
  };

  const columns = computeColumns(scheduledTasks);

  const handleResize = (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => {
    onResizeTask(taskId, edge, deltaSlots);
  };

  const totalHeight = (workHours.end - workHours.start) * SLOT_HEIGHT_PX;

  return (
    <section className="flex-1 flex flex-col bg-surface-container-low rounded-2xl overflow-hidden border border-white/50 relative">
      {/* Date navigation header */}
      <div className="p-6 bg-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            aria-label="Previous day"
            className="p-1.5 hover:bg-surface-container rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold font-headline">{formatDateHeadline(selectedDate)}</h2>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            aria-label="Next day"
            className="p-1.5 hover:bg-surface-container rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <ChevronRight size={20} />
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(getLocalToday())}
              aria-label="Go to today"
              className="ml-2 px-3 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              Today
            </button>
          )}
        </div>
        {/* View mode segment control */}
        <div className="flex bg-surface-container rounded-lg p-1">
          <button className="px-4 py-1.5 text-xs font-semibold bg-white shadow-sm rounded-md">Day</button>
          <button className="px-4 py-1.5 text-xs font-medium text-on-surface-variant/40 cursor-not-allowed" title="Coming soon">3 Day</button>
          <button className="px-4 py-1.5 text-xs font-medium text-on-surface-variant/40 cursor-not-allowed" title="Coming soon">Week</button>
          <button className="px-4 py-1.5 text-xs font-medium text-on-surface-variant/40 cursor-not-allowed" title="Coming soon">Month</button>
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex-1 overflow-y-auto relative" style={{ minHeight: `${totalHeight}px` }}>
        {/* Current time marker (today only) */}
        {isToday && timeMarkerPx > 0 && timeMarkerPx < totalHeight && (
          <div
            className="absolute left-20 right-0 flex items-center z-20 pointer-events-none"
            style={{ top: `${timeMarkerPx}px` }}
          >
            <div className="w-2.5 h-2.5 bg-tertiary rounded-full -ml-1.5" />
            <div className="flex-1 h-[2px] bg-tertiary opacity-60" />
          </div>
        )}

        {/* Scheduled task blocks */}
        {scheduledTasks.map((task) => {
          const topPx = computePosition(task.startTime!, workHours.start, SLOT_HEIGHT_PX);
          const heightPx = computeBlockHeight(task.duration, SLOT_HEIGHT_PX);
          const colInfo = columns.get(task.id) ?? { column: 0, totalColumns: 1 };
          return (
            <DraggableScheduledTask
              key={task.id}
              task={task}
              topPx={topPx}
              heightPx={heightPx}
              workStartHour={workHours.start}
              column={colInfo.column}
              totalColumns={colInfo.totalColumns}
              onComplete={() => onCompleteTask(task.id)}
              onStart={() => onStartTask(task.id)}
              onEdit={() => onEditTask(task)}
              onResize={handleResize}
              onDelete={() => onDeleteTask(task.id)}
            />
          );
        })}

        {/* 15-min droppable grid */}
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

        {/* Empty day state */}
        {scheduledTasks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-on-surface-variant/40">
              <p className="text-sm font-medium">No tasks scheduled</p>
              <p className="text-[10px] mt-1">Drag a task from the backlog to plan your day</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
