import { beforeEach, describe, expect, it } from 'vitest';
import { PlanovaDatabase } from '../../../src/infrastructure/persistence/db';
import { BackupService } from '../../../src/services/backup-service';
import type { Task } from '../../../src/domain/task';
import type { ScheduleBlock } from '../../../src/domain/schedule-block';
import type { BackupBundle } from '../../../src/domain/backup-bundle';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    durationMinutes: 30,
    priority: 'Medium',
    status: 'Pending',
    createdAt: 1000,
    schemaVersion: 2,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    scheduledDate: '2026-04-08',
    startTime: '2026-04-08T09:00:00.000Z',
    endTime: '2026-04-08T10:00:00.000Z',
    schemaVersion: 2,
    ...overrides,
  };
}

let db: PlanovaDatabase;
let service: BackupService;

beforeEach(async () => {
  db = new PlanovaDatabase('test-backup-' + Math.random());
  await db.open();
  service = new BackupService(db);
});

describe('BackupService.export()', () => {
  it('returns an empty bundle when db is empty', async () => {
    const result = await service.export();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe('planova-backup');
      expect(result.value.version).toBe(1);
      expect(result.value.schemaVersion).toBe(2);
      expect(result.value.tasks).toHaveLength(0);
      expect(result.value.scheduleBlocks).toHaveLength(0);
      expect(typeof result.value.exportedAt).toBe('number');
    }
  });

  it('exports existing tasks and scheduleBlocks', async () => {
    await db.tasks.put(makeTask({ id: 'a' }));
    await db.tasks.put(makeTask({ id: 'b' }));
    await db.scheduleBlocks.put(makeBlock({ id: 'sb-1', taskId: 'a' }));

    const result = await service.export();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tasks).toHaveLength(2);
      expect(result.value.scheduleBlocks).toHaveLength(1);
    }
  });
});

describe('BackupService.import() — replace mode', () => {
  it('clears existing data and inserts bundle contents', async () => {
    await db.tasks.put(makeTask({ id: 'old-task' }));
    await db.scheduleBlocks.put(makeBlock({ id: 'old-block' }));

    const bundle: BackupBundle = {
      format: 'planova-backup',
      version: 1,
      exportedAt: Date.now(),
      schemaVersion: 2,
      tasks: [makeTask({ id: 'new-task' })],
      scheduleBlocks: [makeBlock({ id: 'new-block', taskId: 'new-task' })],
    };

    const result = await service.import(bundle, 'replace');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tasksImported).toBe(1);
      expect(result.value.scheduleBlocksImported).toBe(1);
      expect(result.value.conflictsSkipped).toBe(0);
    }

    const allTasks = await db.tasks.toArray();
    expect(allTasks.map((t) => t.id)).toEqual(['new-task']);

    const allBlocks = await db.scheduleBlocks.toArray();
    expect(allBlocks.map((b) => b.id)).toEqual(['new-block']);
  });

  it('overwrites data that shares the same id', async () => {
    await db.tasks.put(makeTask({ id: 'task-1', title: 'Old Title' }));

    const bundle: BackupBundle = {
      format: 'planova-backup',
      version: 1,
      exportedAt: Date.now(),
      schemaVersion: 2,
      tasks: [makeTask({ id: 'task-1', title: 'New Title' })],
      scheduleBlocks: [],
    };

    const result = await service.import(bundle, 'replace');
    expect(result.ok).toBe(true);

    const task = await db.tasks.get('task-1');
    expect(task?.title).toBe('New Title');
  });
});

describe('BackupService.import() — merge mode', () => {
  it('adds new items and skips duplicates', async () => {
    await db.tasks.put(makeTask({ id: 'existing-task' }));

    const bundle: BackupBundle = {
      format: 'planova-backup',
      version: 1,
      exportedAt: Date.now(),
      schemaVersion: 2,
      tasks: [
        makeTask({ id: 'existing-task', title: 'Should Not Overwrite' }),
        makeTask({ id: 'new-task' }),
      ],
      scheduleBlocks: [],
    };

    const result = await service.import(bundle, 'merge');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tasksImported).toBe(1);
      expect(result.value.conflictsSkipped).toBe(1);
    }

    const existing = await db.tasks.get('existing-task');
    expect(existing?.title).toBe('Test Task'); // unchanged
  });

  it('counts block conflicts separately', async () => {
    await db.scheduleBlocks.put(makeBlock({ id: 'block-existing' }));

    const bundle: BackupBundle = {
      format: 'planova-backup',
      version: 1,
      exportedAt: Date.now(),
      schemaVersion: 2,
      tasks: [],
      scheduleBlocks: [
        makeBlock({ id: 'block-existing' }),
        makeBlock({ id: 'block-new', taskId: 'task-1' }),
      ],
    };

    const result = await service.import(bundle, 'merge');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scheduleBlocksImported).toBe(1);
      expect(result.value.conflictsSkipped).toBe(1);
    }
  });
});

describe('BackupService.import() — invalid bundle', () => {
  it('returns backup/invalid-bundle for a malformed bundle', async () => {
    const bad = { format: 'wrong', version: 99 };
    // Cast through unknown to satisfy type checker in test
    const result = await service.import(bad as unknown as BackupBundle, 'replace');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('backup/invalid-bundle');
    }
  });
});

describe('BackupService — export/import round-trip', () => {
  it('restore restores identical data', async () => {
    await db.tasks.put(makeTask({ id: 'rt-task' }));
    await db.scheduleBlocks.put(makeBlock({ id: 'rt-block' }));

    const exportResult = await service.export();
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    await db.tasks.clear();
    await db.scheduleBlocks.clear();

    const importResult = await service.import(exportResult.value, 'replace');
    expect(importResult.ok).toBe(true);

    const tasks = await db.tasks.toArray();
    const blocks = await db.scheduleBlocks.toArray();
    expect(tasks[0].id).toBe('rt-task');
    expect(blocks[0].id).toBe('rt-block');
  });
});
