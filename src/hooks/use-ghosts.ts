/**
 * use-ghosts.ts — React hook that reactively produces GhostBlocks for the
 * day-view timeline and exposes a `materialize` action to turn a ghost into
 * a real Task + ScheduleBlock.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../infrastructure/persistence/db';
import { taskRepository, scheduleBlockRepository } from '../app/dependencies';
import { createTask } from '../domain/task';
import { createScheduleBlock } from '../domain/schedule-block';
import { buildUTCTime } from '../utils/date-utils';
import { getWorkHours } from '../utils/settings';
import { generateGhosts, type GhostBlock } from '../services/ghost-generator';
import type { Task } from '../domain/task';
import type { ScheduleBlock } from '../domain/schedule-block';

function logError(op: string, cause: unknown): void {
  console.log(JSON.stringify({ level: 'error', op, cause: String(cause) }));
}

/**
 * useGhosts — subscribes to completed tasks and today's schedule blocks, then
 * derives a list of GhostBlock suggestions via generateGhosts.
 *
 * @param selectedDate - YYYY-MM-DD of the day currently shown in the timeline.
 * @returns { ghosts, materialize }
 */
export function useGhosts(selectedDate: string): {
  ghosts: GhostBlock[];
  materialize: (ghost: GhostBlock) => Promise<void>;
} {
  const [ghosts, setGhosts] = useState<GhostBlock[]>([]);
  const workHours = getWorkHours();

  useEffect(() => {
    let cancelled = false;

    async function recompute(
      completedTasks: readonly Task[],
      todayBlocks: readonly ScheduleBlock[],
    ): Promise<void> {
      if (cancelled) return;
      const result = generateGhosts(
        completedTasks,
        todayBlocks,
        selectedDate,
        workHours.start,
        workHours.end,
      );
      if (!cancelled) setGhosts(result);
    }

    // Initial load
    let latestCompleted: readonly Task[] = [];
    let latestBlocks: readonly ScheduleBlock[] = [];

    async function loadAll(): Promise<void> {
      const [tasksRes, blocksRes] = await Promise.all([
        taskRepository.listByStatus('Completed'),
        scheduleBlockRepository.listForDate(selectedDate),
      ]);
      if (tasksRes.ok) latestCompleted = tasksRes.value;
      if (blocksRes.ok) latestBlocks = blocksRes.value;
      await recompute(latestCompleted, latestBlocks);
    }

    void loadAll();

    // Live subscriptions via Dexie liveQuery-style watchers
    const unsubTasks = taskRepository.watch((tasks) => {
      latestCompleted = tasks.filter((t) => t.status === 'Completed');
      void recompute(latestCompleted, latestBlocks);
    });

    const unsubBlocks = scheduleBlockRepository.watch(selectedDate, (blocks) => {
      latestBlocks = blocks;
      void recompute(latestCompleted, latestBlocks);
    });

    return () => {
      cancelled = true;
      unsubTasks();
      unsubBlocks();
    };
  }, [selectedDate, workHours.start, workHours.end]);

  /**
   * materialize — converts a ghost into a real Pending Task + ScheduleBlock.
   * The ghost disappears automatically via the live subscription recompute.
   */
  const materialize = useCallback(
    async (ghost: GhostBlock): Promise<void> => {
      const taskId = crypto.randomUUID();
      const startTime = buildUTCTime(selectedDate, ghost.startHour, ghost.startMinute);
      const endMinutes = ghost.startHour * 60 + ghost.startMinute + ghost.durationMinutes;
      const endHour = Math.floor(endMinutes / 60);
      const endMinute = endMinutes % 60;
      const endTime = buildUTCTime(selectedDate, endHour, endMinute);

      const taskValidation = createTask({
        id: taskId,
        title: ghost.title,
        durationMinutes: ghost.durationMinutes,
        priority: ghost.priority,
        status: 'Scheduled',
        createdAt: Date.now(),
        ...(ghost.color !== undefined ? { color: ghost.color } : {}),
      });

      if (!taskValidation.ok) {
        logError('ghost/materialize-task-invalid', taskValidation.error);
        return;
      }

      const taskRes = await taskRepository.create(taskValidation.value);
      if (!taskRes.ok) {
        logError('ghost/materialize-task-create', taskRes.error);
        return;
      }

      const blockValidation = createScheduleBlock({
        id: crypto.randomUUID(),
        taskId,
        scheduledDate: selectedDate,
        startTime,
        endTime,
      });

      if (!blockValidation.ok) {
        logError('ghost/materialize-block-invalid', blockValidation.error);
        // Roll back the task we just created
        await taskRepository.delete(taskId);
        return;
      }

      const blockRes = await scheduleBlockRepository.create(blockValidation.value);
      if (!blockRes.ok) {
        logError('ghost/materialize-block-create', blockRes.error);
        await taskRepository.delete(taskId);
      }
    },
    [selectedDate],
  );

  return { ghosts, materialize };
}
