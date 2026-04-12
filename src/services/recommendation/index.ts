/**
 * Barrel export for the recommendation pipeline.
 */
export { detectPatterns, MIN_COMPLETED_COUNT, LOOKBACK_DAYS } from './pattern-detector';
export { toRecommendations } from './heuristic-recommender';
export { enrichWithLlm } from './llm-recommender';
export type {
  HistoryRow,
  DetectedPattern,
  Recommendation,
  RecommendationSource,
  PatternKind,
} from './types';
