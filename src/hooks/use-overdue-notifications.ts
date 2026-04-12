import { useEffect, useRef } from 'react';
import { db } from '../infrastructure/persistence/db';
import { isTauriEnvironment } from '../infrastructure/tauri/backup-io';

/** Check for overdue tasks every 5 minutes. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Avoid spamming: track which task IDs we already notified about. */
const notifiedIds = new Set<string>();

/**
 * useOverdueNotifications — periodically checks for overdue scheduled tasks
 * and fires OS notifications via Tauri's notification plugin.
 *
 * Only active when running inside Tauri. Does nothing in plain browser dev mode.
 */
export function useOverdueNotifications(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isTauriEnvironment()) return;

    const check = async () => {
      try {
        const now = Date.now();
        const blocks = await db.scheduleBlocks.toArray();
        const tasks = await db.tasks.toArray();
        const taskMap = new Map(tasks.map((t) => [t.id, t]));

        for (const block of blocks) {
          const endMs = Date.parse(block.endTime);
          if (endMs >= now) continue; // not overdue yet

          const task = taskMap.get(block.taskId);
          if (!task) continue;
          if (task.status === 'Completed') continue;
          if (notifiedIds.has(task.id)) continue;

          notifiedIds.add(task.id);

          const {
            isPermissionGranted,
            requestPermission,
            sendNotification,
          } = await import('@tauri-apps/plugin-notification');

          let granted = await isPermissionGranted();
          if (!granted) {
            const permission = await requestPermission();
            granted = permission === 'granted';
          }
          if (!granted) return;

          sendNotification({
            title: '오버듀 작업',
            body: `"${task.title}" 예정 시간이 지났습니다.`,
          });
        }
      } catch (e) {
        console.error(JSON.stringify({ level: 'error', op: 'overdue-check', cause: String(e) }));
      }
    };

    // Initial check after 30 seconds (let the app settle)
    const timeout = setTimeout(() => {
      void check();
      intervalRef.current = setInterval(() => void check(), CHECK_INTERVAL_MS);
    }, 30_000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
