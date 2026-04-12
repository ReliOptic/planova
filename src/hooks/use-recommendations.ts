import { useCallback, useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../infrastructure/persistence/db';
import { taskRepository, openRouterClient } from '../app/dependencies';
import { createTask } from '../domain/task';
import {
  detectPatterns,
  toRecommendations,
  enrichWithLlm,
  MIN_COMPLETED_COUNT,
  LOOKBACK_DAYS,
  type Recommendation,
  type HistoryRow,
} from '../services/recommendation';
import { useOnlineStatus } from './use-online-status';

/** Maximum LLM calls per day. */
const MAX_LLM_CALLS_PER_DAY = 2;

/** Cooldown period for hidden patterns (7 days). */
const HIDDEN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Check if the AI recommendation toggle is enabled in Settings. */
function isAiRecommendationEnabled(): boolean {
  try {
    const raw = localStorage.getItem('planova-rec-enabled');
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

/** Track daily LLM calls. */
async function getLlmCallCount(): Promise<number> {
  const key = `rec:llm-calls:${todayKey()}`;
  const row = await db.meta.get(key);
  return typeof row?.value === 'number' ? row.value : 0;
}

async function incrementLlmCallCount(): Promise<void> {
  const key = `rec:llm-calls:${todayKey()}`;
  const current = await getLlmCallCount();
  await db.meta.put({ key, value: current + 1 });
}

/** Check if a pattern is hidden. */
async function isPatternHidden(patternId: string): Promise<boolean> {
  const key = `rec:hidden:${patternId}`;
  const row = await db.meta.get(key);
  if (typeof row?.value !== 'number') return false;
  return Date.now() - row.value < HIDDEN_COOLDOWN_MS;
}

/** Mark a pattern as hidden for 7 days. */
async function hidePattern(patternId: string): Promise<void> {
  const key = `rec:hidden:${patternId}`;
  await db.meta.put({ key, value: Date.now() });
}

/** Build HistoryRow[] from completed tasks and their schedule blocks. */
async function buildHistory(): Promise<HistoryRow[]> {
  const allTasks = await db.tasks.toArray();
  const allBlocks = await db.scheduleBlocks.toArray();

  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const completedTasks = allTasks.filter(
    (t) => t.status === 'Completed' && t.completedAt != null && t.completedAt >= cutoff,
  );

  const blocksByTaskId = new Map<string, typeof allBlocks>();
  for (const b of allBlocks) {
    const existing = blocksByTaskId.get(b.taskId);
    if (existing) {
      existing.push(b);
    } else {
      blocksByTaskId.set(b.taskId, [b]);
    }
  }

  const rows: HistoryRow[] = [];
  for (const task of completedTasks) {
    const blocks = blocksByTaskId.get(task.id);
    if (!blocks || blocks.length === 0) continue;
    for (const block of blocks) {
      rows.push({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        scheduledDate: block.scheduledDate,
        startTime: block.startTime,
        endTime: block.endTime,
        completedAt: task.completedAt!,
      });
    }
  }

  return rows;
}

export interface UseRecommendationsResult {
  /** Current recommendations. Empty if insufficient history. */
  readonly recommendations: readonly Recommendation[];
  /** How many more completions needed before the feature activates. */
  readonly completionsNeeded: number;
  /** Whether the pipeline is loading data. */
  readonly loading: boolean;
  /** Accept a recommendation: create a Task from it. */
  accept: (rec: Recommendation) => Promise<void>;
  /** Dismiss a recommendation for 7 days. */
  dismiss: (rec: Recommendation) => Promise<void>;
}

/**
 * useRecommendations — orchestrates the full recommendation pipeline.
 *
 * Lifecycle:
 * 1. Subscribe to live task/block changes.
 * 2. Build history on each change.
 * 3. Run local pattern detection.
 * 4. Produce heuristic recommendations (always available).
 * 5. If online + enabled + under daily limit → enrich via LLM.
 * 6. Filter out hidden patterns.
 * 7. Expose accept / dismiss actions.
 */
export function useRecommendations(): UseRecommendationsResult {
  const isOnline = useOnlineStatus();
  const [recommendations, setRecommendations] = useState<readonly Recommendation[]>([]);
  const [completionsNeeded, setCompletionsNeeded] = useState(MIN_COMPLETED_COUNT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAiRecommendationEnabled()) {
      setRecommendations([]);
      setLoading(false);
      return;
    }

    const history = await buildHistory();

    if (history.length < MIN_COMPLETED_COUNT) {
      setCompletionsNeeded(MIN_COMPLETED_COUNT - history.length);
      setRecommendations([]);
      setLoading(false);
      return;
    }
    setCompletionsNeeded(0);

    const patterns = detectPatterns(history);
    if (patterns.length === 0) {
      setRecommendations([]);
      setLoading(false);
      return;
    }

    // Filter hidden patterns.
    const visiblePatterns: typeof patterns[number][] = [];
    for (const p of patterns) {
      if (!(await isPatternHidden(p.id))) {
        visiblePatterns.push(p);
      }
    }

    // Heuristic (always).
    let recs = [...toRecommendations(visiblePatterns)];

    // LLM enrichment (conditional).
    if (isOnline && visiblePatterns.length > 0) {
      const llmCalls = await getLlmCallCount();
      if (llmCalls < MAX_LLM_CALLS_PER_DAY) {
        const llmResult = await enrichWithLlm(visiblePatterns, openRouterClient);
        if (llmResult.ok && llmResult.value.length > 0) {
          await incrementLlmCallCount();
          // Prepend LLM recs before heuristic (LLM is higher quality).
          recs = [...llmResult.value, ...recs];
        }
      }
    }

    // Deduplicate by title (LLM may echo heuristic suggestions).
    const seen = new Set<string>();
    const unique: Recommendation[] = [];
    for (const r of recs) {
      const key = r.title.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }

    setRecommendations(unique.slice(0, 5));
    setLoading(false);
  }, [isOnline]);

  // Subscribe to DB changes to trigger refresh.
  useEffect(() => {
    const sub = liveQuery(async () => {
      const taskCount = await db.tasks.count();
      const blockCount = await db.scheduleBlocks.count();
      return { taskCount, blockCount };
    }).subscribe({
      next: () => {
        void refresh();
      },
      error: () => {
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [refresh]);

  const accept = useCallback(
    async (rec: Recommendation) => {
      const result = createTask({
        id: crypto.randomUUID(),
        title: rec.title,
        durationMinutes: rec.suggestedDurationMinutes ?? 60,
        priority: 'Medium',
        status: 'Pending',
        createdAt: Date.now(),
        ...(rec.suggestedDate ? { due: rec.suggestedDate } : {}),
      });
      if (result.ok) {
        await taskRepository.create(result.value);
      }
      // Refresh happens automatically via liveQuery subscription.
    },
    [],
  );

  const dismiss = useCallback(
    async (rec: Recommendation) => {
      await hidePattern(rec.patternId);
      await refresh();
    },
    [refresh],
  );

  return { recommendations, completionsNeeded, loading, accept, dismiss };
}
