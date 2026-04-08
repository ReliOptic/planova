import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { liveQuery } from 'dexie';
import { db } from '../infrastructure/persistence/db';
import type { Task } from '../domain/task';
import { formatDuration } from '../utils/date-utils';

const PRIORITY_BADGE: Record<Task['priority'], string> = {
  High: 'bg-tertiary-container text-white',
  Medium: 'bg-secondary-container text-on-secondary-container',
  Low: 'bg-surface-container-highest text-on-secondary-container',
};

function formatCompletedAt(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** HistoryView — displays all completed tasks ordered by completion time. */
export const HistoryView: React.FC = () => {
  const [tasks, setTasks] = useState<readonly Task[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() =>
      db.tasks.where('status').equals('Completed').reverse().sortBy('completedAt'),
    ).subscribe({
      next: (result) => setTasks(result),
      error: (cause: unknown) => {
        console.error(
          JSON.stringify({ level: 'error', event: 'history/load-failed', cause: String(cause) }),
        );
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mx-auto mb-6">
            <History className="text-on-surface-variant" size={28} />
          </div>
          <h2 className="text-xl font-bold font-headline text-on-surface mb-2">No completed tasks yet</h2>
          <p className="text-sm text-on-surface-variant">
            Complete tasks from your timeline to see your velocity here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold font-headline text-on-surface mb-4">
        {tasks.length} Completed {tasks.length === 1 ? 'Task' : 'Tasks'}
      </h2>
      <ul className="flex flex-col gap-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="bg-surface-container-lowest rounded-xl shadow-sm px-4 py-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface truncate">{task.title}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {formatDuration(task.durationMinutes)}
                {task.completedAt != null ? ` · ${formatCompletedAt(task.completedAt)}` : ''}
              </p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[task.priority]}`}
            >
              {task.priority}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
