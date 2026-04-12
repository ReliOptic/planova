import Dexie, { type Table } from 'dexie';
import type { Task } from '../../domain/task';
import type { ScheduleBlock } from '../../domain/schedule-block';
import type { AiCredential } from '../../domain/ai-credential';
import type { AiCacheEntry } from '../../domain/ai-cache-entry';
import type { LogEntry } from '../../domain/log-entry';

/** Metadata row stored in the `meta` table (e.g., schema version marker). */
export interface MetaRow {
  readonly key: string;
  readonly value: string | number;
}

/**
 * PlanovaDatabase — Dexie subclass owning the IndexedDB schema.
 *
 * Versions:
 *   v1 — legacy overloaded `tasks` table (Firestore-origin shape).
 *   v2 — split into `tasks` + `scheduleBlocks`, adds `meta` for migration state.
 *   v3 — adds `aiCredentials` (pk `provider`) and `aiCache` (pk `key`, index `createdAt`).
 *   v4 — adds `logs` (pk auto-increment `id`, indexed on `ts`, `level`).
 *   v5 — adds `recurrenceGroupId` index to `tasks` for recurring task series.
 *
 * Tables (v5):
 *   tasks          — pk `id`, indexed on `status`, `createdAt`
 *   scheduleBlocks — pk `id`, indexed on `taskId`, `scheduledDate`
 *   meta           — pk `key`
 *   aiCredentials  — pk `provider`
 *   aiCache        — pk `key`, indexed on `createdAt`
 *   logs           — pk auto-increment `id`, indexed on `ts`, `level`
 */
export class PlanovaDatabase extends Dexie {
  readonly tasks!: Table<Task, string>;
  readonly scheduleBlocks!: Table<ScheduleBlock, string>;
  readonly meta!: Table<MetaRow, string>;
  readonly aiCredentials!: Table<AiCredential, string>;
  readonly aiCache!: Table<AiCacheEntry, string>;
  readonly logs!: Table<LogEntry, number>;

  constructor(name = 'planova') {
    super(name);

    this.version(1).stores({
      tasks: 'id',
    });

    this.version(2).stores({
      tasks: 'id, status, createdAt',
      scheduleBlocks: 'id, taskId, scheduledDate',
      meta: 'key',
    });

    this.version(3).stores({
      tasks: 'id, status, createdAt',
      scheduleBlocks: 'id, taskId, scheduledDate',
      meta: 'key',
      aiCredentials: 'provider',
      aiCache: 'key, createdAt',
    });

    this.version(4).stores({
      tasks: 'id, status, createdAt',
      scheduleBlocks: 'id, taskId, scheduledDate',
      meta: 'key',
      aiCredentials: 'provider',
      aiCache: 'key, createdAt',
      logs: '++id, ts, level',
    });

    this.version(5).stores({
      tasks: 'id, status, createdAt, recurrenceGroupId',
      scheduleBlocks: 'id, taskId, scheduledDate',
      meta: 'key',
      aiCredentials: 'provider',
      aiCache: 'key, createdAt',
      logs: '++id, ts, level',
    });

    this.version(6).stores({
      tasks: 'id, status, createdAt, recurrenceGroupId, group',
      scheduleBlocks: 'id, taskId, scheduledDate',
      meta: 'key',
      aiCredentials: 'provider',
      aiCache: 'key, createdAt',
      logs: '++id, ts, level',
    });
  }
}

/** Singleton instance used by the application. */
export const db = new PlanovaDatabase();
