import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { addDays, formatDateHeadline, getLocalToday } from '@/src/utils/date-utils';

/** The four available view modes. */
export type ViewMode = 'day' | '3day' | 'week' | 'month';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: 'Day',
  '3day': '3 Day',
  week: 'Week',
  month: 'Month',
};

/** Props for TimelineHeader. */
export interface TimelineHeaderProps {
  selectedDate: string;
  viewMode: ViewMode;
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * TimelineHeader — date navigation controls and view-mode segment switcher.
 */
export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  selectedDate,
  viewMode,
  onDateChange,
  onViewModeChange,
}) => {
  const isToday = selectedDate === getLocalToday();

  return (
    <div className="p-6 bg-white flex justify-between items-center">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onDateChange(addDays(selectedDate, -1))}
          aria-label="Previous day"
          className="p-1.5 hover:bg-surface-container rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-xl font-bold font-headline">{formatDateHeadline(selectedDate)}</h2>
        <button
          onClick={() => onDateChange(addDays(selectedDate, 1))}
          aria-label="Next day"
          className="p-1.5 hover:bg-surface-container rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <ChevronRight size={20} />
        </button>
        {!isToday && (
          <button
            onClick={() => onDateChange(getLocalToday())}
            aria-label="Go to today"
            className="ml-2 px-3 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            Today
          </button>
        )}
      </div>
      <div className="flex bg-surface-container rounded-lg p-1">
        {(['day', '3day', 'week', 'month'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-md transition-all',
              viewMode === mode
                ? 'bg-white shadow-sm font-semibold text-on-surface'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {VIEW_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
};
