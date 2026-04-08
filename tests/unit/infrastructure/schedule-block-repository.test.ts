import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanovaDatabase } from '../../../src/infrastructure/persistence/db';
import { DexieScheduleBlockRepository } from '../../../src/infrastructure/persistence/schedule-block-repository';
import type { ScheduleBlock } from '../../../src/domain/schedule-block';

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    scheduledDate: '2026-04-08',
    startTime: '2026-04-08T09:00:00.000Z',
    endTime: '2026-04-08T09:30:00.000Z',
    schemaVersion: 2,
    ...overrides,
  };
}

let db: PlanovaDatabase;
let repo: DexieScheduleBlockRepository;

beforeEach(async () => {
  db = new PlanovaDatabase('test-blocks-' + Math.random());
  await db.open();
  repo = new DexieScheduleBlockRepository(db);
});

describe('DexieScheduleBlockRepository', () => {
  describe('create + get', () => {
    it('creates a block and retrieves it by id', async () => {
      const block = makeBlock();
      const createResult = await repo.create(block);
      expect(createResult.ok).toBe(true);

      const getResult = await repo.get('block-1');
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.id).toBe('block-1');
        expect(getResult.value.taskId).toBe('task-1');
      }
    });

    it('returns repo/not-found for unknown id', async () => {
      const result = await repo.get('ghost');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('repo/not-found');
    });
  });

  describe('listForDate', () => {
    it('returns only blocks on the given date', async () => {
      await repo.create(makeBlock({ id: 'b1', scheduledDate: '2026-04-08' }));
      await repo.create(makeBlock({ id: 'b2', scheduledDate: '2026-04-09' }));
      await repo.create(makeBlock({ id: 'b3', scheduledDate: '2026-04-08' }));

      const result = await repo.listForDate('2026-04-08');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.every((b) => b.scheduledDate === '2026-04-08')).toBe(true);
      }
    });

    it('returns empty array when no blocks exist for date', async () => {
      const result = await repo.listForDate('2099-01-01');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(0);
    });
  });

  describe('listForRange', () => {
    it('returns blocks within inclusive date range', async () => {
      await repo.create(makeBlock({ id: 'b1', scheduledDate: '2026-04-07' }));
      await repo.create(makeBlock({ id: 'b2', scheduledDate: '2026-04-08' }));
      await repo.create(makeBlock({ id: 'b3', scheduledDate: '2026-04-09' }));
      await repo.create(makeBlock({ id: 'b4', scheduledDate: '2026-04-10' }));

      const result = await repo.listForRange('2026-04-08', '2026-04-09');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        const ids = result.value.map((b) => b.id);
        expect(ids).toContain('b2');
        expect(ids).toContain('b3');
      }
    });
  });

  describe('getByTaskId', () => {
    it('returns all blocks for a task', async () => {
      await repo.create(makeBlock({ id: 'b1', taskId: 'task-A' }));
      await repo.create(makeBlock({ id: 'b2', taskId: 'task-A' }));
      await repo.create(makeBlock({ id: 'b3', taskId: 'task-B' }));

      const result = await repo.getByTaskId('task-A');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.every((b) => b.taskId === 'task-A')).toBe(true);
      }
    });
  });

  describe('update', () => {
    it('applies patch to an existing block', async () => {
      await repo.create(makeBlock());
      const updateResult = await repo.update('block-1', { scheduledDate: '2026-04-10' });
      expect(updateResult.ok).toBe(true);

      const getResult = await repo.get('block-1');
      expect(getResult.ok).toBe(true);
      if (getResult.ok) expect(getResult.value.scheduledDate).toBe('2026-04-10');
    });

    it('returns repo/not-found when updating nonexistent block', async () => {
      const result = await repo.update('ghost', { scheduledDate: '2026-04-10' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('repo/not-found');
    });
  });

  describe('delete', () => {
    it('removes a block so it is no longer retrievable', async () => {
      await repo.create(makeBlock());
      await repo.delete('block-1');

      const getResult = await repo.get('block-1');
      expect(getResult.ok).toBe(false);
    });
  });

  describe('watch', () => {
    it('fires onChange when a block is created on the watched date', async () => {
      const onChange = vi.fn();
      const unsub = repo.watch('2026-04-08', onChange);

      await new Promise((resolve) => setTimeout(resolve, 50));
      await repo.create(makeBlock({ id: 'b1', scheduledDate: '2026-04-08' }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenCalled();
      const lastBlocks = onChange.mock.calls[onChange.mock.calls.length - 1][0] as readonly ScheduleBlock[];
      expect(lastBlocks.some((b) => b.id === 'b1')).toBe(true);

      unsub();
    });

    it('does not fire onChange for blocks on a different date', async () => {
      const onChange = vi.fn();
      const unsub = repo.watch('2026-04-08', onChange);

      await new Promise((resolve) => setTimeout(resolve, 50));
      const callsBefore = onChange.mock.calls.length;

      await repo.create(makeBlock({ id: 'bX', scheduledDate: '2026-04-09' }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      // onChange may fire but with an empty array (date filter still returns nothing)
      const callsAfter = onChange.mock.calls.length;
      if (callsAfter > callsBefore) {
        const lastBlocks = onChange.mock.calls[callsAfter - 1][0] as readonly ScheduleBlock[];
        expect(lastBlocks.every((b) => b.scheduledDate === '2026-04-08')).toBe(true);
      }

      unsub();
    });
  });
});
