import type { DetectedPattern, Recommendation } from './types';
import { addDays, getLocalToday, formatLocalDate } from '../../utils/date-utils';

/** Maximum recommendations returned per call. */
const MAX_RECOMMENDATIONS = 5;

/** Map day index (0 = Sunday) to the Korean label. */
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * Peak day — index of the day with the highest histogram count.
 * Ties go to the first (earliest in the week).
 */
function peakDay(histogram: readonly number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < histogram.length; i++) {
    if (histogram[i] > histogram[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

/** Peak hour — index of the hour with the highest histogram count. */
function peakHour(histogram: readonly number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < histogram.length; i++) {
    if (histogram[i] > histogram[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

/**
 * Next occurrence of a target day-of-week relative to today.
 * If today is the target day, returns today.
 * @returns YYYY-MM-DD string.
 */
function nextWeekday(targetDay: number, today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const todayDate = new Date(y, m - 1, d);
  const todayDay = todayDate.getDay();
  const diff = (targetDay - todayDay + 7) % 7;
  return diff === 0 ? today : addDays(today, diff);
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Convert detected patterns into concrete, deterministic recommendations.
 *
 * No LLM call — all text is template-based. This function must remain pure
 * and synchronous so it works offline.
 */
export function toRecommendations(
  patterns: readonly DetectedPattern[],
  nowDate: string = getLocalToday(),
): readonly Recommendation[] {
  const recs: Recommendation[] = [];

  for (const p of patterns) {
    if (recs.length >= MAX_RECOMMENDATIONS) break;

    switch (p.kind) {
      case 'weekday-time': {
        const day = peakDay(p.dayOfWeekHistogram);
        const hour = peakHour(p.hourHistogram);
        const suggestedDate = nextWeekday(day, nowDate);
        const title = p.titles[0] ?? '제목 없음';

        recs.push({
          id: `rec-${simpleHash(p.id + suggestedDate)}`,
          patternId: p.id,
          title,
          rationale: `매주 ${DAY_LABELS[day]}요일 ${hour}시에 자주 수행하신 작업입니다 (최근 ${p.occurrences}회).`,
          suggestedDate,
          suggestedStartHour: hour,
          suggestedDurationMinutes: 60,
          source: 'heuristic',
        });
        break;
      }

      case 'recurring-title': {
        const title = p.titles[0] ?? '제목 없음';
        recs.push({
          id: `rec-${simpleHash(p.id + nowDate)}`,
          patternId: p.id,
          title,
          rationale: `"${title}"을(를) 최근 ${p.occurrences}회 완료하셨습니다. 이번 주에도 하실래요?`,
          source: 'heuristic',
        });
        break;
      }

      case 'title-cluster': {
        const groupName = p.titles[0] ?? '유사 작업';
        recs.push({
          id: `rec-${simpleHash(p.id + nowDate)}`,
          patternId: p.id,
          title: groupName,
          rationale: `"${groupName}" 계열 작업을 ${p.occurrences}회 수행하셨습니다.`,
          source: 'heuristic',
        });
        break;
      }
    }
  }

  return recs;
}
