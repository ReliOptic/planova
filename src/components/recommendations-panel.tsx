import React from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import type { Recommendation } from '../services/recommendation/types';

interface RecommendationsPanelProps {
  readonly recommendations: readonly Recommendation[];
  readonly completionsNeeded: number;
  readonly loading: boolean;
  readonly onAccept: (rec: Recommendation) => void;
  readonly onDismiss: (rec: Recommendation) => void;
}

/**
 * RecommendationsPanel — sidebar card that shows AI-generated (or heuristic)
 * task suggestions based on the user's completion history patterns.
 *
 * Shows progress badge when insufficient data, recommendation cards when ready.
 */
export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  recommendations,
  completionsNeeded,
  loading,
  onAccept,
  onDismiss,
}) => {
  if (loading) return null;

  return (
    <section className="mb-4" role="complementary" aria-label="AI 추천">
      <div className="flex items-center gap-1.5 px-2 mb-2">
        <Sparkles size={12} className="text-primary" />
        <span className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase">추천</span>
      </div>

      {completionsNeeded > 0 ? (
        <div className="px-2 py-2 mx-1 rounded-lg bg-surface-container">
          <p className="text-[11px] text-on-surface-variant leading-snug">
            추천 활성화까지{' '}
            <span className="font-bold text-primary">{completionsNeeded}개</span>{' '}
            더 완료하세요.
          </p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="px-2 py-2 mx-1 rounded-lg bg-surface-container">
          <p className="text-[11px] text-on-surface-variant">감지된 패턴이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-1.5 mx-1">
          {recommendations.slice(0, 3).map((rec) => (
            <div
              key={rec.id}
              className="group px-3 py-2.5 rounded-lg bg-white border border-outline-variant/20 shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-on-surface leading-tight flex-1">
                  {rec.title}
                </p>
                <button
                  onClick={() => onDismiss(rec)}
                  aria-label="추천 숨기기"
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <X size={12} className="text-slate-400" />
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
                {rec.rationale}
              </p>
              {rec.suggestedDate && (
                <p className="text-[10px] text-primary/70 mt-1">
                  {rec.suggestedDate}
                  {rec.suggestedStartHour != null && ` · ${rec.suggestedStartHour}:00`}
                </p>
              )}
              <button
                onClick={() => onAccept(rec)}
                className="mt-2 flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary-dark transition-colors focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded px-1 py-0.5"
              >
                <Plus size={10} />
                추가
              </button>
              {rec.source === 'llm' && (
                <span className="text-[9px] text-slate-300 mt-0.5 block">AI</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
