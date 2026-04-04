import React from 'react';
import { GripVertical, Clock, Calendar, Flag } from 'lucide-react';
import { Task } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TaskCardProps {
  task: Task;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
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
        <div {...attributes} {...listeners} className="p-1 hover:bg-surface-container rounded transition-colors">
          <GripVertical className="text-outline-variant group-hover:text-primary transition-colors" size={18} />
        </div>
      </div>

      <h3 className="font-semibold text-on-surface mb-2 font-headline">{task.title}</h3>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
          <Clock size={14} />
          <span>{task.duration} duration</span>
        </div>
        {task.due && (
          <div className="flex items-center gap-2 text-on-surface-variant text-xs">
            <Calendar size={14} />
            <span>Due: {task.due}</span>
          </div>
        )}
      </div>

      {task.status === 'In Progress' && task.progress !== undefined && (
        <div className="w-full h-1 bg-primary-fixed rounded-full overflow-hidden mt-4">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${task.progress}%` }}></div>
        </div>
      )}
    </div>
  );
};
