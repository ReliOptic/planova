/**
 * LogEntry — a single structured log record persisted to IndexedDB.
 */
export interface LogEntry {
  /** Auto-assigned primary key by Dexie. Absent before insertion. */
  readonly id?: number;
  /** Unix epoch milliseconds when the entry was created. */
  readonly ts: number;
  /** Severity level of the log entry. */
  readonly level: 'info' | 'warn' | 'error';
  /** Dot-separated feature/module scope, e.g. `react/error-boundary`. */
  readonly scope: string;
  /** Human-readable description of the event. */
  readonly message: string;
  /** Optional structured key–value context for the entry. */
  readonly context?: Readonly<Record<string, unknown>>;
}
