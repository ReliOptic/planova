import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanovaDatabase } from '../../../src/infrastructure/persistence/db';
import { DexieTaskRepository } from '../../../src/infrastructure/persistence/task-repository';
import type { Task } from '../../../src/domain/task';

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

let db: PlanovaDatabase;
let repo: DexieTaskRepository;

beforeEach(async () => {
  // Fresh isolated DB per test
  db = new PlanovaDatabase('test-tasks-' + Math.random());
  await db.open();
  repo = new DexieTaskRepository(db);
});

describe('DexieTaskRepository', () => {
  describe('create + get', () => {
    it('creates a task and retrieves it by id', async () => {
      const task = makeTask();
      const createResult = await repo.create(task);
      expect(createResult.ok).toBe(true);

      const getResult = await repo.get('task-1');
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.id).toBe('task-1');
        expect(getResult.value.title).toBe('Test Task');
      }
    });

    it('returns repo/not-found for unknown id', async () => {
      const result = await repo.get('nonexistent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('repo/not-found');
      }
    });
  });

  describe('list', () => {
    it('returns all tasks ordered by createdAt descending', async () => {
      await repo.create(makeTask({ id: 'a', createdAt: 100 }));
      await repo.create(makeTask({ id: 'b', createdAt: 200 }));
      await repo.create(makeTask({ id: 'c', createdAt: 50 }));

      const result = await repo.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.map((t) => t.id)).toEqual(['b', 'a', 'c']);
      }
    });

    it('returns empty array when no tasks exist', async () => {
      const result = await repo.list();
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(0);
    });
  });

  describe('listByStatus', () => {
    it('returns only tasks with the requested status', async () => {
      await repo.create(makeTask({ id: 'p1', status: 'Pending' }));
      await repo.create(makeTask({ id: 'p2', status: 'Pending' }));
      await repo.create(makeTask({ id: 'c1', status: 'Completed' }));

      const result = await repo.listByStatus('Pending');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.every((t) => t.status === 'Pending')).toBe(true);
      }
    });
  });

  describe('update', () => {
    it('applies patch to an existing task', async () => {
      await repo.create(makeTask());
      const updateResult = await repo.update('task-1', { title: 'Updated', status: 'In Progress' });
      expect(updateResult.ok).toBe(true);

      const getResult = await repo.get('task-1');
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.title).toBe('Updated');
        expect(getResult.value.status).toBe('In Progress');
      }
    });

    it('returns repo/not-found when updating nonexistent task', async () => {
      const result = await repo.update('ghost', { title: 'X' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('repo/not-found');
    });
  });

  describe('delete', () => {
    it('removes a task so it is no longer retrievable', async () => {
      await repo.create(makeTask());
      const delResult = await repo.delete('task-1');
      expect(delResult.ok).toBe(true);

      const getResult = await repo.get('task-1');
      expect(getResult.ok).toBe(false);
    });
  });

  describe('watch', () => {
    it('fires onChange when a task is created', async () => {
      const onChange = vi.fn();
      const unsub = repo.watch(onChange);

      // liveQuery fires immediately with current state, then on changes
      await new Promise((resolve) => setTimeout(resolve, 50));
      await repo.create(makeTask());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as readonly Task[];
      expect(lastCall.some((t) => t.id === 'task-1')).toBe(true);

      unsub();
    });
  });
});
