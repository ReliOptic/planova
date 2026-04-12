import type { OpenRouterClient } from '../../infrastructure/ai/openrouter-client';
import type { AppError } from '../../domain/errors';
import { ok, err, type Result } from '../../domain/result';
import type { DetectedPattern, Recommendation } from './types';

/** LLM timeout in milliseconds. */
const LLM_TIMEOUT_MS = 10_000;

/**
 * Schema of a single recommendation inside the LLM JSON response.
 */
interface LlmRecommendationRow {
  readonly title: string;
  readonly rationale: string;
  readonly suggestedDate?: string | null;
  readonly suggestedStartHour?: number | null;
  readonly suggestedDurationMinutes?: number | null;
}

/** Full shape the model should return. */
interface LlmRecommendationResponse {
  readonly recommendations: readonly LlmRecommendationRow[];
}

function isLlmResponse(v: unknown): v is LlmRecommendationResponse {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o['recommendations'])) return false;
  return o['recommendations'].every(
    (r: unknown) =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as Record<string, unknown>)['title'] === 'string' &&
      typeof (r as Record<string, unknown>)['rationale'] === 'string',
  );
}

const SYSTEM_PROMPT = `You are a productivity coach. Given detected patterns from the user's completed task history, output up to 3 recommended tasks as JSON matching this schema: {"recommendations":[{"title":string,"rationale":string,"suggestedDate":string|null,"suggestedStartHour":number|null,"suggestedDurationMinutes":number|null}]}. No prose. No markdown. JSON only.`;

function buildUserPrompt(patterns: readonly DetectedPattern[]): string {
  const compact = patterns.map((p) => ({
    kind: p.kind,
    label: p.label,
    titles: p.titles,
    occurrences: p.occurrences,
    confidence: p.confidence,
    lastOccurrence: p.lastOccurrence,
  }));
  return JSON.stringify(compact);
}

/** Build a deterministic cache key from patterns and a tag. */
function recCachePrefix(patterns: readonly DetectedPattern[]): string {
  const ids = patterns.map((p) => p.id).sort().join(',');
  return `rec:${ids}`;
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Enrich recommendations by sending a pattern summary to the LLM.
 *
 * Falls back to an empty array (caller should use heuristic recommendations)
 * on any LLM failure: offline, rate-limit, timeout, schema mismatch, etc.
 */
export async function enrichWithLlm(
  patterns: readonly DetectedPattern[],
  client: OpenRouterClient,
): Promise<Result<readonly Recommendation[], AppError>> {
  if (patterns.length === 0) return ok([]);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const result = await client.complete({
      prompt: buildUserPrompt(patterns),
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 512,
      signal: controller.signal,
    });

    if (!result.ok) {
      return ok([]);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.value);
    } catch {
      return ok([]);
    }

    if (!isLlmResponse(parsed)) {
      return ok([]);
    }

    const prefix = recCachePrefix(patterns);
    const recs: Recommendation[] = parsed.recommendations.map((r, i) => ({
      id: `llm-${simpleHash(prefix + i)}`,
      patternId: patterns[Math.min(i, patterns.length - 1)]?.id ?? 'unknown',
      title: r.title,
      rationale: r.rationale,
      suggestedDate: r.suggestedDate ?? undefined,
      suggestedStartHour: r.suggestedStartHour ?? undefined,
      suggestedDurationMinutes: r.suggestedDurationMinutes ?? undefined,
      source: 'llm' as const,
    }));

    return ok(recs);
  } finally {
    clearTimeout(timer);
  }
}
