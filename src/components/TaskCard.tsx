import React from 'react';
import { GripVertical, Clock, Calendar, Trash2, Repeat } from 'lucide-react';
import { Task } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { formatDuration, formatDueDate, getLocalToday } from '@/src/utils/date-utils';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TaskCardProps {
  task: Task;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  const priorityColors = {
    High: "bg-tertiary-container text-white",
    Medium: "bg-secondary-container text-on-secondary-container",
    Low: "bg-surface-container-highest text-on-secondary-container",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onDoubleClick={onEdit}
      className={cn(
        "bg-surface-container-lowest p-4 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:bg-surface-container-high transition-colors group",
        task.status === 'In Progress' && "border-l-4 border-primary",
        isDragging && "shadow-xl ring-2 ring-primary/20"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        {task.status === 'In Progress' ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-primary">In Progress</span>
          </div>
        ) : (
          <span className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-tighter rounded-full", priorityColors[task.priority])}>
            {task.priority} Priority
          </span>
        )}
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-on-surface-variant hover:text-tertiary transition-colors opacity-0 group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:opacity-100 rounded"
              title="Delete task"
              aria-label="Delete task"
            >
              <Trash2 size={14} />
            </button>
          )}
          <div {...attributes} {...listeners} aria-label="Drag to reorder" className="p-1 hover:bg-surface-container rounded transition-colors">
            <GripVertical className="text-outline-variant group-hover:text-primary transition-colors" size={18} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-1">
        <h3 className="font-semibold text-on-surface font-headline">{task.title}</h3>
        {task.recurrenceRule && (
          <Repeat size={13} className="text-primary shrink-0" title="반복 작업" />
        )}
      </div>
      {task.group && (
        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-1.5">
          {task.group}
        </span>
      )}
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
          <Clock size={14} />
          <span>{formatDuration(task.duration)}</span>
        </div>
        {task.due && (
          <div className="flex items-center gap-2 text-on-surface-variant text-xs">
            <Calendar size={14} />
            <span className={cn(task.due < getLocalToday() && "text-tertiary")}>
              Due: {formatDueDate(task.due)}
            </span>
          </div>
        )}
      </div>

    </div>
  );
};
