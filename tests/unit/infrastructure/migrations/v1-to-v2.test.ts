import { describe, it, expect } from 'vitest';
import { migrateV1ToV2 } from '../../../../src/infrastructure/persistence/migrations/v1-to-v2';
import { type LegacyTaskV1 } from '../../../../src/infrastructure/persistence/migrations/legacy-task-v1';

// ── fixtures ─────────────────────────────────────────────────────────────────

const BASE: LegacyTaskV1 = {
  id: 'task-1',
  uid: 'user-abc',
  title: 'Write tests',
  duration: 30,
  priority: 'Medium',
  status: 'Pending',
  createdAt: 1_700_000_000_000,
  schemaVersion: 1,
};

const SCHEDULED_COMPLETE: LegacyTaskV1 = {
  id: 'task-2',
  uid: 'user-abc',
  title: 'Design review',
  duration: 60,
  priority: 'High',
  status: 'Scheduled',
  createdAt: 1_700_000_001_000,
  scheduledDate: '2026-04-10',
  startTime: '2026-04-10T09:00:00.000Z',
  endTime: '2026-04-10T10:00:00.000Z',
  schemaVersion: 1,
};

const COMPLETED_WITH_STALE_SCHEDULE: LegacyTaskV1 = {
  id: 'task-3',
  uid: 'user-abc',
  title: 'Ship feature',
  duration: 90,
  priority: 'High',
  status: 'Completed',
  createdAt: 1_700_000_002_000,
  completedAt: 1_700_000_999_000,
  scheduledDate: '2026-04-05',
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T15:30:00.000Z',
  schemaVersion: 1,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('migrateV1ToV2', () => {
  it('returns empty arrays for empty input', () => {
    const result = migrateV1ToV2([]);
    expect(result.tasks).toHaveLength(0);
    expect(result.scheduleBlocks).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  describe('happy path — 3 legacy tasks', () => {
    it('produces correct task and schedule-block counts', () => {
      const result = migrateV1ToV2([BASE, SCHEDULED_COMPLETE, COMPLETED_WITH_STALE_SCHEDULE]);
      // All 3 tasks migrate; 2 have complete schedule fields (task-2 and task-3).
      expect(result.tasks).toHaveLength(3);
      expect(result.scheduleBlocks).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
    });

    it('pending task: uid dropped, duration renamed, schemaVersion 2', () => {
      const result = migrateV1ToV2([BASE]);
      const task = result.tasks[0];
      expect(task.id).toBe('task-1');
      expect(task.title).toBe('Write tests');
      expect(task.durationMinutes).toBe(30);
      expect(task.status).toBe('Pending');
      expect(task.priority).toBe('Medium');
      expect(task.schemaVersion).toBe(2);
      // uid must NOT appear on Task
      expect(Object.keys(task)).not.toContain('uid');
      // duration (old name) must NOT appear
      expect(Object.keys(task)).not.toContain('duration');
    });

    it('scheduled task: emits ScheduleBlock with correct taskId and schemaVersion', () => {
      const result = migrateV1ToV2([SCHEDULED_COMPLETE]);
      expect(result.scheduleBlocks).toHaveLength(1);
      const block = result.scheduleBlocks[0];
      expect(block.taskId).toBe('task-2');
      expect(block.scheduledDate).toBe('2026-04-10');
      expect(block.startTime).toBe('2026-04-10T09:00:00.000Z');
      expect(block.endTime).toBe('2026-04-10T10:00:00.000Z');
      expect(block.schemaVersion).toBe(2);
      // id must be a non-empty UUID
      expect(typeof block.id).toBe('string');
      expect(block.id.length).toBeGreaterThan(0);
    });

    it('completed task with stale schedule fields: keeps Completed status and emits ScheduleBlock', () => {
      const result = migrateV1ToV2([COMPLETED_WITH_STALE_SCHEDULE]);
      expect(result.tasks[0].status).toBe('Completed');
      expect(result.tasks[0].completedAt).toBe(1_700_000_999_000);
      expect(result.scheduleBlocks).toHaveLength(1);
      expect(result.scheduleBlocks[0].taskId).toBe('task-3');
    });
  });

  describe('incomplete schedule fields on active-status tasks', () => {
    it('Scheduled task missing startTime → skipped + downgraded to Pending', () => {
      const broken: LegacyTaskV1 = {
        ...SCHEDULED_COMPLETE,
        id: 'task-bad',
        startTime: undefined,
      };
      const result = migrateV1ToV2([broken]);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].status).toBe('Pending');
      expect(result.scheduleBlocks).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toEqual({
        id: 'task-bad',
        reason: 'incomplete-schedule-fields',
      });
    });

    it('In Progress task missing endTime → skipped + downgraded to Pending', () => {
      const inProgress: LegacyTaskV1 = {
        ...SCHEDULED_COMPLETE,
        id: 'task-ip',
        status: 'In Progress',
        endTime: undefined,
      };
      const result = migrateV1ToV2([inProgress]);
      expect(result.tasks[0].status).toBe('Pending');
      expect(result.skipped[0].reason).toBe('incomplete-schedule-fields');
    });

    it('In Progress task missing scheduledDate → skipped', () => {
      const inProgress: LegacyTaskV1 = {
        ...SCHEDULED_COMPLETE,
        id: 'task-ip2',
        status: 'In Progress',
        scheduledDate: undefined,
      };
      const result = migrateV1ToV2([inProgress]);
      expect(result.tasks[0].status).toBe('Pending');
      expect(result.skipped).toHaveLength(1);
    });
  });

  describe('missing schemaVersion treated as v1', () => {
    it('document without schemaVersion field migrates correctly', () => {
      const noVersion: LegacyTaskV1 = {
        id: 'task-nv',
        uid: 'user-x',
        title: 'No version',
        duration: 15,
        priority: 'Low',
        status: 'Pending',
        createdAt: 1_700_000_003_000,
        // schemaVersion intentionally absent
      };
      const result = migrateV1ToV2([noVersion]);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].schemaVersion).toBe(2);
    });
  });

  describe('optional field propagation', () => {
    it('description and due are forwarded when present', () => {
      const withOptionals: LegacyTaskV1 = {
        ...BASE,
        id: 'task-opt',
        description: 'A detailed description',
        due: '2026-04-30',
      };
      const result = migrateV1ToV2([withOptionals]);
      const task = result.tasks[0];
      expect(task.description).toBe('A detailed description');
      expect(task.due).toBe('2026-04-30');
    });

    it('scheduleBlock ids are unique across multiple scheduled tasks', () => {
      const second: LegacyTaskV1 = { ...SCHEDULED_COMPLETE, id: 'task-2b' };
      const result = migrateV1ToV2([SCHEDULED_COMPLETE, second]);
      const ids = result.scheduleBlocks.map((b) => b.id);
      expect(new Set(ids).size).toBe(2);
    });
  });

  describe('schemaVersion on all outputs', () => {
    it('every Task in result has schemaVersion 2', () => {
      const result = migrateV1ToV2([BASE, SCHEDULED_COMPLETE, COMPLETED_WITH_STALE_SCHEDULE]);
      for (const task of result.tasks) {
        expect(task.schemaVersion).toBe(2);
      }
    });

    it('every ScheduleBlock in result has schemaVersion 2', () => {
      const result = migrateV1ToV2([SCHEDULED_COMPLETE, COMPLETED_WITH_STALE_SCHEDULE]);
      for (const block of result.scheduleBlocks) {
        expect(block.schemaVersion).toBe(2);
      }
    });
  });
});
