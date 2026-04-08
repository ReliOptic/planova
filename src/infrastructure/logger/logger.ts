import type { LogEntry } from '../../domain/log-entry';
import type { PlanovaDatabase } from '../persistence/db';

/**
 * Logger — structured JSON logger interface backed by a persistent store.
 */
export interface Logger {
  /** Log an informational event. */
  info(scope: string, message: string, context?: Record<string, unknown>): void;
  /** Log a warning event. */
  warn(scope: string, message: string, context?: Record<string, unknown>): void;
  /** Log an error event. */
  error(scope: string, message: string, context?: Record<string, unknown>): void;
  /** Return the most recent `limit` entries ordered by ts descending. */
  listRecent(limit?: number): Promise<readonly LogEntry[]>;
  /** Delete all log entries from the store. */
  clear(): Promise<void>;
}

/**
 * DexieRingBufferLogger — Logger implementation backed by a Dexie `logs` table.
 *
 * - Each write is fire-and-forget; a `.catch` guard ensures logging never throws.
 * - Mirrors every write to the native `console` as a single-line JSON string.
 * - Maintains a rolling ring buffer capped at `maxEntries` (default 500).
 *   After each insert, if the total count exceeds the cap the oldest rows are
 *   deleted so the table stays within budget.
 */
export class DexieRingBufferLogger implements Logger {
  private readonly db: PlanovaDatabase;
  private readonly maxEntries: number;

  constructor(db: PlanovaDatabase, maxEntries = 500) {
    this.db = db;
    this.maxEntries = maxEntries;
  }

  info(scope: string, message: string, context?: Record<string, unknown>): void {
    this.write('info', scope, message, context);
  }

  warn(scope: string, message: string, context?: Record<string, unknown>): void {
    this.write('warn', scope, message, context);
  }

  error(scope: string, message: string, context?: Record<string, unknown>): void {
    this.write('error', scope, message, context);
  }

  async listRecent(limit = 100): Promise<readonly LogEntry[]> {
    const all = await this.db.logs.orderBy('ts').reverse().limit(limit).toArray();
    return all;
  }

  async clear(): Promise<void> {
    await this.db.logs.clear();
  }

  private write(
    level: LogEntry['level'],
    scope: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      ts: Date.now(),
      level,
      scope,
      message,
      ...(context !== undefined ? { context } : {}),
    };

    this.mirrorToConsole(entry);

    this.db.logs
      .add(entry)
      .then(() => this.evictOldEntries())
      .catch((cause: unknown) => {
        // Intentionally swallow — logging must never throw.
        console.warn(
          JSON.stringify({ ts: entry.ts, level: 'warn', scope: 'logger', message: 'log-write-failed', cause: String(cause) }),
        );
      });
  }

  private mirrorToConsole(entry: LogEntry): void {
    const line = JSON.stringify({
      ts: entry.ts,
      level: entry.level,
      scope: entry.scope,
      message: entry.message,
      ...entry.context,
    });

    if (entry.level === 'error') {
      console.error(line);
    } else if (entry.level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  private evictOldEntries(): void {
    this.db.logs
      .count()
      .then(async (count) => {
        if (count <= this.maxEntries) return;
        const excess = count - this.maxEntries;
        const oldest = await this.db.logs.orderBy('id').limit(excess).primaryKeys();
        await this.db.logs.bulkDelete(oldest);
      })
      .catch((cause: unknown) => {
        console.warn(
          JSON.stringify({ level: 'warn', scope: 'logger', message: 'evict-failed', cause: String(cause) }),
        );
      });
  }
}
