import React from 'react';
import { ChevronLeft, ChevronRight, Edit2, ChevronsUpDown, Flag } from 'lucide-react';
import { Task } from '@/src/types';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/src/lib/utils';

interface TimelineProps {
  tasks: Task[];
}

const DroppableSlot: React.FC<{ hour: string; index: number }> = ({ hour, index }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${hour}`,
    data: { hour, index },
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "h-20 transition-colors cursor-cell relative group",
        isOver ? "bg-primary/5" : "hover:bg-white/40"
      )}
    >
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-lg m-1 pointer-events-none" />
      )}
    </div>
  );
};

const DraggableScheduledTask: React.FC<{ task: Task; top: number }> = ({ task, top }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    top: `${top}px`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 10,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "absolute left-4 right-4 p-3 group cursor-grab active:cursor-grabbing transition-all rounded-lg border-l-4",
        task.status === 'In Progress' 
          ? "h-40 bg-primary/10 border-primary shadow-lg shadow-primary/10 hover:bg-primary/20"
          : "h-24 bg-secondary-container/30 border-on-secondary-container hover:bg-secondary-container/50",
        isDragging && "shadow-2xl ring-2 ring-primary/30"
      )}
    >
      <div className="flex justify-between items-start">
        <h4 className={cn("text-sm font-bold font-headline", task.status === 'In Progress' ? 'text-primary' : 'text-on-secondary-container')}>
          {task.title}
        </h4>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded shadow-sm", task.status === 'In Progress' ? 'bg-primary text-white' : 'bg-on-secondary-container text-white')}>
            {task.startTime} - {task.endTime}
          </span>
          {task.status === 'In Progress' && (
            <button className="p-1 bg-white/80 rounded-full text-primary hover:bg-white shadow-sm transition-all scale-0 group-hover:scale-100">
              <Edit2 size={12} />
            </button>
          )}
        </div>
      </div>
      {task.description && <p className={cn("text-[11px] mt-1", task.status === 'In Progress' ? 'text-primary/80' : 'text-on-secondary-container/80')}>{task.description}</p>}
      
      {task.status === 'In Progress' && task.progress !== undefined && (
        <div className="mt-4 flex items-center gap-3 bg-white/90 p-2 rounded-lg shadow-sm w-48 border border-primary/20">
          <div className="flex-1 h-1.5 bg-primary-fixed rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${task.progress}%` }}></div>
          </div>
          <span className="text-[10px] font-bold text-primary">{task.progress}%</span>
          <ChevronsUpDown size={12} className="text-primary/60" />
        </div>
      )}
    </div>
  );
};

export const Timeline: React.FC<TimelineProps> = ({ tasks }) => {
  const hours = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'
  ];

  const scheduledTasks = tasks.filter(t => t.startTime);

  // Helper to calculate top position based on start time
  const getTaskPosition = (startTime: string) => {
    const hourIndex = hours.indexOf(startTime);
    if (hourIndex === -1) return 0;
    return hourIndex * 5 * 16; // 5rem = 80px per hour
  };

  return (
    <section className="flex-1 flex flex-col bg-surface-container-low rounded-2xl overflow-hidden border border-white/50 relative">
      <div className="p-6 bg-white flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold font-headline">October 2024</h2>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-surface-container rounded-lg transition-colors"><ChevronLeft size={20} /></button>
            <button className="p-1 hover:bg-surface-container rounded-lg transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
        <div className="flex bg-surface-container rounded-lg p-1">
          <button className="px-4 py-1.5 text-xs font-semibold bg-white shadow-sm rounded-md">Day</button>
          <button className="px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors">Week</button>
          <button className="px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors">Month</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 bg-surface-container-low/50 border-r border-outline-variant/10 flex flex-col py-4">
          {hours.map(hour => (
            <div key={hour} className="h-20 flex justify-center text-[10px] font-bold text-on-surface-variant uppercase tracking-widest pt-1">
              {hour}
            </div>
          ))}
        </div>

        <div className="flex-1 relative overflow-y-auto bg-[linear-gradient(to_bottom,transparent_4.95rem,#e2e8f0_5rem)] bg-[size:100%_5rem]">
          {/* Current Time Marker */}
          <div className="absolute top-[12rem] left-0 w-full flex items-center z-10 pointer-events-none">
            <div className="w-2 h-2 bg-tertiary rounded-full -ml-1"></div>
            <div className="flex-1 h-[2px] bg-tertiary opacity-40"></div>
          </div>

          {/* Scheduled Tasks */}
          {scheduledTasks.map((task) => (
            <DraggableScheduledTask 
              key={task.id} 
              task={task} 
              top={getTaskPosition(task.startTime!)} 
            />
          ))}

          {/* Deadline Indicator */}
          <div className="absolute top-[35rem] right-8 flex flex-col items-end">
            <div className="flex items-center gap-2 bg-tertiary-container/10 border border-tertiary text-tertiary px-3 py-1.5 rounded-lg shadow-sm">
              <Flag size={14} fill="currentColor" />
              <span className="text-xs font-bold uppercase tracking-tight">Final Submission Deadline</span>
            </div>
            <div className="w-[1px] h-20 border-r-2 border-dashed border-tertiary mr-4"></div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-outline-variant/5">
            {hours.map((hour, i) => (
              <DroppableSlot key={hour} hour={hour} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
