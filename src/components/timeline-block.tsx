import React, { useState } from 'react';
import { GripVertical, Check, Trash2, Repeat } from 'lucide-react';
import { Task } from '@/src/types';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { formatTimeDisplay, isPastTime } from '@/src/utils/date-utils';
import { buildBlockStyle, startResize } from './timeline-block-utils';
import { TASK_COLOR_MAP, type TaskColor } from '@/src/domain/task';

/** Props for DraggableScheduledTask. */
export interface DraggableScheduledTaskProps {
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
}

/**
 * DraggableScheduledTask — a positioned, draggable, resizable task block
 * rendered inside the day-view timeline grid.
 */
export const DraggableScheduledTask: React.FC<DraggableScheduledTaskProps> = ({
  task,
  topPx,
  heightPx,
  column,
  totalColumns,
  onComplete,
  onStart,
  onEdit,
  onResize,
  onDelete,
}) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const isOverdue =
    task.status === 'Scheduled' && task.endTime !== undefined && isPastTime(task.endTime);

  const style = buildBlockStyle(topPx, heightPx, column, totalColumns, transform, isDragging, isResizing);

  // Use task color if set, otherwise fall back to status-based colors
  const taskColor = (task as { color?: TaskColor }).color;
  const colorStyle = taskColor && TASK_COLOR_MAP[taskColor];
  const statusColors = colorStyle
    ? `${colorStyle.bg} border-transparent ${colorStyle.text}`
    : isOverdue
      ? 'bg-tertiary-container/10 border-tertiary'
      : task.status === 'In Progress'
        ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
        : 'bg-secondary-container/30 border-on-secondary-container';

  const handleComplete = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (isCompleting) return;
    setIsCompleting(true);
    try { await onComplete(); } catch { setIsCompleting(false); }
  };

  const handleStart = (e: React.MouseEvent): void => { e.stopPropagation(); onStart(); };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onDoubleClick={onEdit}
      className={cn(
        'absolute p-3 group rounded-lg border-l-4 transition-all overflow-hidden',
        statusColors,
        isDragging && 'shadow-2xl ring-2 ring-primary/30',
      )}
    >
      <div
        onMouseDown={(e) => startResize(e, 'top', task.id, onResize, setIsResizing)}
        onTouchStart={(e) => startResize(e, 'top', task.id, onResize, setIsResizing)}
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
              'text-sm font-bold font-headline truncate flex items-center gap-1',
              isOverdue ? 'text-tertiary'
                : task.status === 'In Progress' ? 'text-primary'
                : 'text-on-secondary-container',
            )}
          >
            {task.title}
            {task.recurrenceRule && <Repeat size={12} className="shrink-0 opacity-70" title="반복 작업" />}
          </h4>
        </div>
        <TaskBlockActions
          task={task}
          isOverdue={isOverdue}
          isCompleting={isCompleting}
          onComplete={handleComplete}
          onStart={handleStart}
          onDelete={onDelete}
        />
      </div>
      {task.description && heightPx > 48 && (
        <p className={cn(
          'text-[11px] mt-1 ml-8 truncate',
          task.status === 'In Progress' ? 'text-primary/80' : 'text-on-secondary-container/80',
        )}>
          {task.description}
        </p>
      )}
      <div
        onMouseDown={(e) => startResize(e, 'bottom', task.id, onResize, setIsResizing)}
        onTouchStart={(e) => startResize(e, 'bottom', task.id, onResize, setIsResizing)}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity z-20"
      />
    </div>
  );
};

interface TaskBlockActionsProps {
  task: Task;
  isOverdue: boolean;
  isCompleting: boolean;
  onComplete: (e: React.MouseEvent) => void;
  onStart: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

const TaskBlockActions: React.FC<TaskBlockActionsProps> = ({
  task, isOverdue, isCompleting, onComplete, onStart, onDelete,
}) => (
  <div className="flex items-center gap-1.5 shrink-0">
    {task.startTime && task.endTime && (
      <span className={cn(
        'text-[10px] font-bold px-2 py-0.5 rounded shadow-sm',
        task.status === 'In Progress' ? 'bg-primary text-white'
          : isOverdue ? 'bg-tertiary text-white'
          : 'bg-on-secondary-container text-white',
      )}>
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
        onClick={onStart}
        className="p-1 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-all opacity-0 group-hover:opacity-100"
        title="Start task"
      >
        <Check size={12} />
      </button>
    )}
    {(task.status === 'In Progress' || isOverdue) && (
      <motion.button
        onClick={onComplete}
        disabled={isCompleting}
        animate={isCompleting ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3, type: 'spring' }}
        className={cn(
          'p-1 rounded-full transition-all',
          isCompleting
            ? 'bg-green-500 text-white'
            : 'bg-white/80 text-primary hover:bg-primary hover:text-white shadow-sm opacity-0 group-hover:opacity-100',
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
);
