import React, { useState } from 'react';
import { motion } from 'motion/react';
import { buildBlockStyle } from './timeline-block-utils';
import { computePosition, computeBlockHeight, buildUTCTime } from '../utils/date-utils';
import { TASK_COLOR_MAP } from '../domain/task';
import { SLOT_HEIGHT_PX } from './TimelineShared';
import type { GhostBlock as GhostBlockType } from '../services/ghost-generator';
import type { TaskColor } from '../domain/task';

interface GhostBlockProps {
  ghost: GhostBlockType;
  workStartHour: number;
  selectedDate: string;
  onMaterialize: (ghost: GhostBlockType) => Promise<void>;
}

/**
 * GhostBlock — a faded, dashed-border block rendered on the day-view timeline.
 *
 * Represents a task from a previous day at the same time slot. Clicking it
 * materializes a real Task + ScheduleBlock via `onMaterialize`.
 */
export const GhostBlock: React.FC<GhostBlockProps> = ({
  ghost,
  workStartHour,
  selectedDate,
  onMaterialize,
}) => {
  const [isMaterializing, setIsMaterializing] = useState(false);

  // Compute pixel position using the same helpers as DraggableScheduledTask
  const startTimeIso = buildUTCTime(selectedDate, ghost.startHour, ghost.startMinute);
  const topPx = computePosition(startTimeIso, workStartHour, SLOT_HEIGHT_PX);
  const heightPx = computeBlockHeight(ghost.durationMinutes, SLOT_HEIGHT_PX);

  // Use buildBlockStyle with no column overlap (ghosts are always single-column)
  const style = buildBlockStyle(topPx, heightPx, 0, 1, null, false, false);

  const colorStyle = ghost.color
    ? TASK_COLOR_MAP[ghost.color as TaskColor]
    : undefined;

  const handleClick = async (): Promise<void> => {
    if (isMaterializing) return;
    setIsMaterializing(true);
    try {
      await onMaterialize(ghost);
    } catch {
      setIsMaterializing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0.3 }}
      animate={{
        opacity: isMaterializing ? 1 : 0.3,
        scale: isMaterializing ? 1.02 : 1,
      }}
      whileHover={{ opacity: 0.6 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, duration: 0.3 }}
      style={style}
      onClick={handleClick}
      title="클릭하여 오늘 일정에 추가"
      aria-label={`${ghost.title} — 클릭하여 오늘 일정에 추가`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleClick();
        }
      }}
      className={[
        'absolute p-3 rounded-lg border-l-4 border-dashed cursor-pointer',
        'transition-colors overflow-hidden select-none',
        colorStyle
          ? `${colorStyle.bg} border-current`
          : 'bg-secondary-container/20 border-on-secondary-container/40',
        isMaterializing
          ? 'border-solid ring-2 ring-primary/30 shadow-lg'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={[
            'text-sm font-bold font-headline truncate',
            colorStyle ? colorStyle.text : 'text-on-secondary-container/60',
          ].join(' ')}
        >
          {ghost.title}
        </span>
      </div>
      {heightPx > 48 && (
        <p className="text-[10px] mt-1 opacity-70 text-on-secondary-container/50">
          {ghost.durationMinutes} min · 어제 일정
        </p>
      )}
    </motion.div>
  );
};
