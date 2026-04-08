import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/src/lib/utils';

// Re-export extracted modules so existing importers need no changes.
export { DraggableScheduledTask } from './timeline-block';
export type { DraggableScheduledTaskProps } from './timeline-block';
export { computeColumns } from './timeline-geometry';
export type { TaskColumnInfo } from './timeline-geometry';

/** Height in pixels of one hour in the timeline grid (4 slots × 20px). */
export const SLOT_HEIGHT_PX = 80;

/** Props for DroppableSlot. */
export interface DroppableSlotProps {
  hour: number;
  minute: number;
  label: string;
  isHourStart: boolean;
  selectedDate: string;
  isCurrentHour?: boolean;
}

/**
 * DroppableSlot — a single 15-minute drop target cell in the timeline grid.
 *
 * Renders hour/half-hour dividers and an hour label when isHourStart is true.
 */
export const DroppableSlot: React.FC<DroppableSlotProps> = ({
  hour,
  minute,
  label,
  isHourStart,
  selectedDate,
  isCurrentHour,
}) => {
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
        isQuarterHour && 'border-t-0',
      )}
    >
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded m-0.5 pointer-events-none" />
      )}
      {isHourStart && (
        <span className="absolute -left-20 w-18 text-right text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-widest pt-0.5">
          {label}
        </span>
      )}
    </div>
  );
};
