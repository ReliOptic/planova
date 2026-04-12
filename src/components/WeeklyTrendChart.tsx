import React from 'react';
import type { DayAccuracy } from '../services/weekly-trend';

interface WeeklyTrendChartProps {
  data: DayAccuracy[];
  todayDate: string;
  weekAverage: number;
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 64;
const BAR_WIDTH = 28;
const BAR_RADIUS = 4;
const GAP = (CHART_WIDTH - 7 * BAR_WIDTH) / 6; // spacing between bars

/** Map 0-100 accuracy to a bar height (min 4px for visibility). */
function barHeight(accuracy: number): number {
  return Math.max(4, (accuracy / 100) * CHART_HEIGHT);
}

export const WeeklyTrendChart: React.FC<WeeklyTrendChartProps> = ({
  data,
  todayDate,
  weekAverage,
}) => {
  return (
    <div className="bg-surface-container-lowest rounded-2xl px-4 py-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
          주간 정확도 추이
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
          이번 주 평균 {weekAverage}%
        </span>
      </div>

      {/* SVG bar chart */}
      <svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        aria-label="주간 정확도 차트"
        style={{ display: 'block' }}
      >
        {data.map((day, i) => {
          const x = i * (BAR_WIDTH + GAP);
          const isToday = day.date === todayDate;
          const isNull = day.accuracy === null;
          const h = isNull ? 4 : barHeight(day.accuracy ?? 0);
          const y = CHART_HEIGHT - h;
          const fill = isNull
            ? 'var(--color-outline-variant)'
            : isToday
              ? 'var(--color-tertiary-container)'
              : 'var(--color-primary-container)';

          return (
            <rect
              key={day.date}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={h}
              rx={BAR_RADIUS}
              ry={BAR_RADIUS}
              fill={fill}
              opacity={isNull ? 0.45 : 1}
            />
          );
        })}
      </svg>

      {/* Day labels + accuracy percentages */}
      <div className="flex mt-1" style={{ gap: `${GAP}px` }}>
        {data.map((day) => {
          const isToday = day.date === todayDate;
          return (
            <div
              key={day.date}
              className="flex flex-col items-center"
              style={{ width: `${BAR_WIDTH}px`, flexShrink: 0 }}
            >
              <span
                className={`text-[10px] font-semibold leading-none ${
                  isToday ? 'text-tertiary-container' : 'text-on-surface-variant'
                }`}
              >
                {day.dayLabel}
              </span>
              <span className="text-[9px] leading-none mt-0.5 text-on-surface-variant">
                {day.accuracy !== null ? `${Math.round(day.accuracy)}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
