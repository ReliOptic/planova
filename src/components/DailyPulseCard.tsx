import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  Flame,
  Target,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { DailyPulseData } from '../services/daily-pulse';
import { formatDuration } from '../utils/date-utils';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated gauge ring showing accuracy percentage. */
const AccuracyGauge: React.FC<{ accuracy: number }> = ({ accuracy }) => {
  const [displayed, setDisplayed] = useState(0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round(accuracy * 100);

  useEffect(() => {
    let start: number | null = null;
    const duration = 800;

    const step = (timestamp: number): void => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-in-out cubic
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      setDisplayed(Math.round(eased * pct));
      if (progress < 1) requestAnimationFrame(step);
    };

    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const strokeOffset = circumference - (displayed / 100) * circumference;
  const color =
    pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-100"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            style={{ transition: 'stroke-dashoffset 0.05s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-on-surface">{displayed}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-on-surface-variant">계획 정확도</span>
    </div>
  );
};

/** Animated count-up number. */
const CountUp: React.FC<{ value: number; suffix?: string; className?: string }> = ({
  value,
  suffix = '',
  className,
}) => {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 400;

    const step = (timestamp: number): void => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayed(Math.round(progress * value));
      if (progress < 1) requestAnimationFrame(step);
    };

    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className}>
      {displayed}
      {suffix}
    </span>
  );
};

/** Mini sparkline bar chart for weekly accuracy. */
const WeeklySparkline: React.FC<{
  data: Array<{ date: string; accuracy: number }>;
}> = ({ data }) => {
  if (data.length === 0) return null;

  const maxH = 32;

  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((d, i) => {
        const h = Math.max(4, Math.round(d.accuracy * maxH));
        const color =
          d.accuracy >= 0.8
            ? 'bg-green-400'
            : d.accuracy >= 0.6
            ? 'bg-amber-400'
            : 'bg-red-400';
        return (
          <motion.div
            key={d.date}
            className={cn('w-4 rounded-sm', color)}
            initial={{ height: 0 }}
            animate={{ height: h }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
            title={`${d.date}: ${Math.round(d.accuracy * 100)}%`}
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

interface DailyPulseCardProps {
  readonly data: DailyPulseData;
  readonly onDismiss: () => void;
}

export const DailyPulseCard: React.FC<DailyPulseCardProps> = ({ data, onDismiss }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDismiss]);

  const deviationSign = (dev: number): string =>
    dev > 0 ? `+${dev}분` : `${dev}분`;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white border border-outline-variant/20 rounded-2xl shadow-xl p-6 w-full max-w-md"
      role="dialog"
      aria-label="오늘의 Daily Pulse"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-black text-on-surface font-headline leading-tight">
            오늘의 Daily Pulse
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {data.completedCount}개 완료 · {data.date}
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="닫기"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-on-surface-variant transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <X size={16} />
        </button>
      </div>

      {/* Accuracy gauge — always shown (requires ≥1 task) */}
      {data.accuracy !== null && (
        <div className="flex justify-center mb-5">
          <AccuracyGauge accuracy={data.accuracy} />
        </div>
      )}

      {/* Total planned vs actual */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-surface-container rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={13} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              계획
            </span>
          </div>
          <p className="text-base font-black text-on-surface">
            <CountUp value={data.totalPlannedMinutes} />
            <span className="text-xs font-normal text-on-surface-variant ml-0.5">분</span>
          </p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {formatDuration(data.totalPlannedMinutes)}
          </p>
        </div>
        <div className="bg-surface-container rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={13} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              실제
            </span>
          </div>
          <p className="text-base font-black text-on-surface">
            <CountUp value={data.totalActualMinutes} />
            <span className="text-xs font-normal text-on-surface-variant ml-0.5">분</span>
          </p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {formatDuration(data.totalActualMinutes)}
          </p>
        </div>
      </div>

      {/* Most over task — ≥1 task, only when deviation > 0 */}
      {data.mostOverTask && (data.mostOverTask.deviationMinutes ?? 0) > 0 && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-amber-600" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
              가장 초과한 작업
            </span>
          </div>
          <p className="text-sm font-semibold text-on-surface leading-tight">
            {data.mostOverTask.title}
          </p>
          <p className="text-xs text-amber-700 mt-0.5 font-medium">
            {deviationSign(data.mostOverTask.deviationMinutes ?? 0)} 초과
          </p>
        </div>
      )}

      {/* Most accurate task — ≥2 tasks */}
      {data.mostAccurateTask && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-green-50 border border-green-100">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={13} className="text-green-600" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-green-700">
              가장 정확한 작업
            </span>
          </div>
          <p className="text-sm font-semibold text-on-surface leading-tight">
            {data.mostAccurateTask.title}
          </p>
          <p className="text-xs text-green-700 mt-0.5 font-medium">
            편차 {Math.abs(data.mostAccurateTask.deviationMinutes ?? 0)}분
          </p>
        </div>
      )}

      {/* Gap segments — ≥2 tasks */}
      {data.gapSegments.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown size={13} className="text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              빈 시간 구간
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.gapSegments.map((gap, i) => {
              const startH = Math.floor(gap.startHour);
              const startM = Math.round((gap.startHour - startH) * 60);
              const endH = Math.floor(gap.endHour);
              const endM = Math.round((gap.endHour - endH) * 60);
              const fmt = (h: number, m: number): string =>
                `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              return (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium"
                >
                  {fmt(startH, startM)}–{fmt(endH, endM)} ({gap.durationMinutes}분)
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly accuracy sparkline — ≥3 days */}
      {data.weeklyAccuracy.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <BarChart2 size={13} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                주간 정확도 추이
              </span>
            </div>
            <span className="text-[10px] text-on-surface-variant">
              7일 평균{' '}
              <span className="font-bold text-on-surface">
                {Math.round(
                  (data.weeklyAccuracy.reduce((s, d) => s + d.accuracy, 0) /
                    data.weeklyAccuracy.length) *
                    100,
                )}
                %
              </span>
            </span>
          </div>
          <WeeklySparkline data={data.weeklyAccuracy} />
        </div>
      )}

      {/* Streak counter */}
      {data.streak.days > 0 && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <span className="text-sm font-bold text-on-surface">
            <CountUp value={data.streak.days} />일 연속 기록 중
          </span>
          {data.streak.hasFreezeToday && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">
              스트릭 프리즈 사용
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Overlay wrapper for positioning
// ---------------------------------------------------------------------------

interface DailyPulseOverlayProps {
  readonly data: DailyPulseData | null;
  readonly isVisible: boolean;
  readonly onDismiss: () => void;
}

export const DailyPulseOverlay: React.FC<DailyPulseOverlayProps> = ({
  data,
  isVisible,
  onDismiss,
}) => {
  return (
    <AnimatePresence>
      {isVisible && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-end justify-center pb-8 px-4 pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-md">
            <DailyPulseCard data={data} onDismiss={onDismiss} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
