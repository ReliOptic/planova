import { describe, it, expect, beforeEach } from 'vitest';
import { PlanovaDatabase } from '../../../../src/infrastructure/persistence/db';
import type { Table } from 'dexie';
import { runMigrations } from '../../../../src/infrastructure/persistence/migrations/runner';
import { type LegacyTaskV1 } from '../../../../src/infrastructure/persistence/migrations/legacy-task-v1';

// fake-indexeddb is auto-installed via tests/setup.ts

// ── helpers ───────────────────────────────────────────────────────────────────

/** Each test gets a fresh DB with a unique name to avoid state bleed. */
let dbCounter = 0;
function freshDb(): PlanovaDatabase {
  dbCounter += 1;
  return new PlanovaDatabase(`planova-test-${dbCounter}`);
}

const LEGACY_SCHEDULED: LegacyTaskV1 = {
  id: 'legacy-1',
  uid: 'user-abc',
  title: 'Plan sprint',
  duration: 45,
  priority: 'High',
  status: 'Scheduled',
  createdAt: 1_700_000_000_000,
  scheduledDate: '2026-04-12',
  startTime: '2026-04-12T08:00:00.000Z',
  endTime: '2026-04-12T08:45:00.000Z',
  schemaVersion: 1,
};

const LEGACY_PENDING: LegacyTaskV1 = {
  id: 'legacy-2',
  uid: 'user-abc',
  title: 'Write docs',
  duration: 20,
  priority: 'Low',
  status: 'Pending',
  createdAt: 1_700_000_001_000,
  schemaVersion: 1,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('runMigrations', () => {
  let db: PlanovaDatabase;

  beforeEach(() => {
    db = freshDb();
  });

  it('first run on empty DB → no-op, sets meta to v2, returns empty result', async () => {
    const result = await runMigrations(db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.tasks).toHaveLength(0);
    expect(result.value.scheduleBlocks).toHaveLength(0);
    expect(result.value.skipped).toHaveLength(0);

    // Meta row must exist and be v2.
    const meta = await db.meta.get('schemaVersion');
    expect(meta?.value).toBe(2);
  });

  it('first run with v1 data → migrates tasks + scheduleBlocks, sets meta to v2', async () => {
    // Seed v1 tasks directly via raw put (bypasses domain validation).
    await (db.tasks as unknown as Table<LegacyTaskV1, string>).bulkPut([LEGACY_SCHEDULED, LEGACY_PENDING]);

    const result = await runMigrations(db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Two tasks should be migrated.
    expect(result.value.tasks).toHaveLength(2);
    // One schedule block (only LEGACY_SCHEDULED has full fields).
    expect(result.value.scheduleBlocks).toHaveLength(1);

    // Verify tasks table was rewritten with v2 shape.
    const storedTasks = await db.tasks.toArray();
    expect(storedTasks).toHaveLength(2);
    for (const t of storedTasks) {
      expect(t.schemaVersion).toBe(2);
    }

    // Verify schedule-blocks table was populated.
    const storedBlocks = await db.scheduleBlocks.toArray();
    expect(storedBlocks).toHaveLength(1);
    expect(storedBlocks[0].taskId).toBe('legacy-1');

    // Verify meta.
    const meta = await db.meta.get('schemaVersion');
    expect(meta?.value).toBe(2);
  });

  it('second run (already v2) → no-op, returns empty result', async () => {
    // Simulate a DB that already completed migration.
    await db.meta.put({ key: 'schemaVersion', value: 2 });

    const result = await runMigrations(db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.tasks).toHaveLength(0);
    expect(result.value.scheduleBlocks).toHaveLength(0);
    expect(result.value.skipped).toHaveLength(0);
  });

  it('migration is idempotent — running twice does not duplicate records', async () => {
    await (db.tasks as unknown as Table<LegacyTaskV1, string>).bulkPut([LEGACY_PENDING]);

    await runMigrations(db);
    await runMigrations(db); // second call should be no-op

    const storedTasks = await db.tasks.toArray();
    expect(storedTasks).toHaveLength(1);
    const storedBlocks = await db.scheduleBlocks.toArray();
    expect(storedBlocks).toHaveLength(0);
  });

  it('migrated task has uid field removed and durationMinutes correct', async () => {
    await (db.tasks as unknown as Table<LegacyTaskV1, string>).bulkPut([LEGACY_PENDING]);

    const result = await runMigrations(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const task = result.value.tasks.find((t) => t.id === 'legacy-2');
    expect(task).toBeDefined();
    expect(task?.durationMinutes).toBe(20);
    expect(Object.keys(task!)).not.toContain('uid');
  });
});
