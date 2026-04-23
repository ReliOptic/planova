import React, { useState } from 'react';
import { GripVertical, Check, Trash2, Repeat } from 'lucide-react';
import { Task } from '@/src/types';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { formatTimeDisplay, isPastTime } from '@/src/utils/date-utils';
import {
  buildBlockStyle,
  startResize,
} from './timeline-block-utils';
import { TASK_COLOR_MAP, type TaskColor } from '@/src/domain/task';
import { getDeviationTier, DEVIATION_STYLES } from '@/src/services/task-view-model';
import { computeBlockColorStyle } from '@/src/utils/block-color';

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

  const isCompleted = task.status === 'Completed';
  const dragAttributes = isCompleted ? {} : attributes;
  const dragListeners = isCompleted ? {} : listeners;
  const isOverdue =
    task.status === 'Scheduled' && task.endTime !== undefined && isPastTime(task.endTime);

  const style = buildBlockStyle(topPx, heightPx, column, totalColumns, transform, isDragging, isResizing);

  // Deviation data for completed tasks
  const deviationMinutes = (task as { deviationMinutes?: number }).deviationMinutes;
  const hasDeviation = isCompleted && deviationMinutes !== undefined;
  const deviationTier = hasDeviation ? getDeviationTier(deviationMinutes) : undefined;
  const deviationStyle = deviationTier ? DEVIATION_STYLES[deviationTier] : undefined;

  // Use task color if set, otherwise fall back to status-based colors
  const taskColor = (task as { color?: TaskColor }).color;
  const taskOpacity = (task as { opacity?: number }).opacity ?? 100;
  const blockColorStyle = !isCompleted && taskColor
    ? computeBlockColorStyle(TASK_COLOR_MAP[taskColor].hex, taskOpacity)
    : undefined;
  const statusColors = isCompleted
    ? `${deviationStyle?.bg ?? 'bg-surface-container'} border-transparent`
    : blockColorStyle
      ? ''
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
      ref={isCompleted ? undefined : setNodeRef}
      style={{
        ...style,
        ...(blockColorStyle ? {
          backgroundColor: blockColorStyle.backgroundColor,
          borderLeftColor: blockColorStyle.borderColor,
        } : {}),
      }}
      {...dragAttributes}
      {...dragListeners}
      onDoubleClick={isCompleted ? undefined : onEdit}
      className={cn(
        'absolute p-3 group rounded-lg border-l-4 transition-colors overflow-hidden',
        statusColors,
        isDragging && 'shadow-2xl ring-2 ring-primary/30',
        isCompleted && 'opacity-80',
        !isCompleted && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* Completed hatching overlay */}
      {isCompleted && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 6px)',
          }}
        />
      )}
      {!isCompleted && (
        <div
          onMouseDown={(e) => startResize(e, 'top', task.id, onResize, setIsResizing)}
          onTouchStart={(e) => startResize(e, 'top', task.id, onResize, setIsResizing)}
          data-no-drag="true"
          className="absolute top-0 left-0 right-0 h-2 cursor-n-resize opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity z-20"
          aria-label="블록 크기 조절"
        />
      )}
      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isCompleted ? (
            <div className="p-1 shrink-0">
              <Check className="text-green-600" size={14} />
            </div>
          ) : (
            <div
              className="p-1 hover:bg-surface-container rounded cursor-grab active:cursor-grabbing shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="드래그하여 이동"
            >
              <GripVertical className="text-outline-variant group-hover:text-primary transition-colors" size={14} />
            </div>
          )}
          <h4
            style={blockColorStyle ? { color: blockColorStyle.color } : undefined}
            className={cn(
              'text-sm font-bold font-headline truncate flex items-center gap-1',
              isCompleted ? (deviationStyle?.text ?? 'text-on-surface-variant')
                : isOverdue ? 'text-tertiary'
                : task.status === 'In Progress' ? 'text-primary'
                : 'text-on-secondary-container',
            )}
          >
            {isCompleted && <span className="line-through decoration-1">{task.title}</span>}
            {!isCompleted && task.title}
            {task.recurrenceRule && <Repeat size={12} className="shrink-0 opacity-70" title="반복 작업" />}
          </h4>
        </div>
        {isCompleted ? (
          /* Deviation badge */
          hasDeviation && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                deviationStyle?.badge,
              )}
            >
              {deviationMinutes > 0 ? `+${deviationMinutes}분` : deviationMinutes === 0 ? '정확' : `${deviationMinutes}분`}
              {deviationMinutes > 0 ? ' ▲' : deviationMinutes < 0 ? ' ▼' : ' ✓'}
            </motion.span>
          )
        ) : (
          <TaskBlockActions
            task={task}
            isOverdue={isOverdue}
            isCompleting={isCompleting}
            blockColorStyle={blockColorStyle}
            onComplete={handleComplete}
            onStart={handleStart}
            onDelete={onDelete}
          />
        )}
      </div>
      {/* Plan vs actual summary for completed blocks with enough height */}
      {isCompleted && hasDeviation && heightPx > 48 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={cn('text-[10px] mt-1 ml-8 relative z-10', deviationStyle?.text)}
        >
          계획 {task.duration}분 → 실제 {(task as { actualDurationMinutes?: number }).actualDurationMinutes}분
        </motion.p>
      )}
      {!isCompleted && task.description && heightPx > 48 && (
        <p
          style={blockColorStyle ? { color: blockColorStyle.color, opacity: 0.8 } : undefined}
          className={cn(
            'text-[11px] mt-1 ml-8 truncate',
            task.status === 'In Progress' ? 'text-primary/80' : 'text-on-secondary-container/80',
          )}
        >
          {task.description}
        </p>
      )}
      {!isCompleted && (
        <div
          onMouseDown={(e) => startResize(e, 'bottom', task.id, onResize, setIsResizing)}
          onTouchStart={(e) => startResize(e, 'bottom', task.id, onResize, setIsResizing)}
          data-no-drag="true"
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity z-20"
          aria-label="블록 크기 조절"
        />
      )}
    </div>
  );
};

interface TaskBlockActionsProps {
  task: Task;
  isOverdue: boolean;
  isCompleting: boolean;
  blockColorStyle?: import('@/src/utils/block-color').BlockColorStyle;
  onComplete: (e: React.MouseEvent) => void;
  onStart: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

const TaskBlockActions: React.FC<TaskBlockActionsProps> = ({
  task, isOverdue, isCompleting, blockColorStyle, onComplete, onStart, onDelete,
}) => (
  <div className="flex items-center gap-1.5 shrink-0">
    {task.startTime && task.endTime && (
      <span
        style={blockColorStyle ? { backgroundColor: blockColorStyle.borderColor, color: blockColorStyle.color } : undefined}
        className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded shadow-sm',
          task.status === 'In Progress' ? 'bg-primary text-white'
            : isOverdue ? 'bg-tertiary text-white'
            : 'bg-on-secondary-container text-white',
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
        onClick={onStart}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        data-no-drag="true"
        className="p-1 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        title="Start task"
        aria-label="작업 시작"
      >
        <Check size={12} />
      </button>
    )}
    {(task.status === 'In Progress' || isOverdue) && (
      <motion.button
        onClick={onComplete}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        disabled={isCompleting}
        data-no-drag="true"
        animate={isCompleting ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3, type: 'spring' }}
        className={cn(
          'p-1 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
          isCompleting
            ? 'bg-green-500 text-white'
            : 'bg-white/80 text-primary hover:bg-primary hover:text-white shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
        title="Mark complete"
        aria-label="작업 완료"
      >
        <Check size={12} />
      </motion.button>
    )}
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      data-no-drag="true"
      className="p-1 rounded text-on-surface-variant hover:text-tertiary transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      title="Delete task"
      aria-label="작업 삭제"
    >
      <Trash2 size={12} />
    </button>
  </div>
);
