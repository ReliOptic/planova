import { describe, it, expect, beforeEach } from 'vitest';
import { generateGhosts, type CompletedTaskSnapshot } from '../../../src/services/ghost-generator';
import type { ScheduleBlock } from '../../../src/domain/schedule-block';
import { buildUTCTime, addDays, getLocalToday } from '../../../src/utils/date-utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(
  overrides: Partial<CompletedTaskSnapshot> & { id: string },
): CompletedTaskSnapshot {
  return {
    title: 'Test Task',
    priority: 'Medium',
    durationMinutes: 60,
    ...overrides,
  };
}

function makeBlock(
  date: string,
  startHour: number,
  startMinute: number,
  durationMinutes: number,
): ScheduleBlock {
  const startTime = buildUTCTime(date, startHour, startMinute);
  const endTime = buildUTCTime(date, startHour, startMinute + durationMinutes);
  return {
    id: `block-${date}-${startHour}-${startMinute}`,
    taskId: `task-${date}-${startHour}`,
    scheduledDate: date,
    startTime,
    endTime,
    schemaVersion: 2,
  };
}

const TODAY = getLocalToday();
const YESTERDAY = addDays(TODAY, -1);
const WORK_START = 9;
const WORK_END = 18;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateGhosts', () => {
  it('returns empty array when no completed tasks exist', () => {
    const ghosts = generateGhosts([], [], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(0);
  });

  it('returns empty array when completed tasks have no completedStartTime', () => {
    const task = makeTask({ id: 't1', completedScheduledDate: YESTERDAY });
    const ghosts = generateGhosts([task], [], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(0);
  });

  it('generates a ghost from yesterday completed task', () => {
    const task = makeTask({
      id: 't1',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 10, 0),
      durationMinutes: 60,
    });

    const ghosts = generateGhosts([task], [], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].source).toBe('yesterday');
    expect(ghosts[0].startHour).toBe(10);
    expect(ghosts[0].startMinute).toBe(0);
    expect(ghosts[0].durationMinutes).toBe(60);
    expect(ghosts[0].title).toBe('Test Task');
    expect(ghosts[0].priority).toBe('Medium');
  });

  it('uses actualDurationMinutes over durationMinutes when available', () => {
    const task = makeTask({
      id: 't1',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 9, 0),
      durationMinutes: 60,
      actualDurationMinutes: 45,
    });

    const ghosts = generateGhosts([task], [], TODAY, WORK_START, WORK_END);
    expect(ghosts[0].durationMinutes).toBe(45);
  });

  it('skips tasks scheduled outside work hours', () => {
    const beforeWork = makeTask({
      id: 't1',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 7, 0), // before workStart=9
      durationMinutes: 60,
    });
    const afterWork = makeTask({
      id: 't2',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 18, 0), // at workEnd
      durationMinutes: 60,
    });

    const ghosts = generateGhosts([beforeWork, afterWork], [], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(0);
  });

  it('filters ghosts that overlap existing today blocks', () => {
    const task = makeTask({
      id: 't1',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 10, 0),
      durationMinutes: 60,
    });

    // Today already has a block at 10:00-11:00
    const todayBlock = makeBlock(TODAY, 10, 0, 60);
    const ghosts = generateGhosts([task], [todayBlock], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(0);
  });

  it('allows ghost when today block is adjacent (no overlap)', () => {
    const task = makeTask({
      id: 't1',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 9, 0),
      durationMinutes: 60,
    });

    // Today has a block at 10:00 — adjacent to 9:00-10:00 ghost, no overlap
    const todayBlock = makeBlock(TODAY, 10, 0, 60);
    const ghosts = generateGhosts([task], [todayBlock], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(1);
  });

  it('does not generate duplicate ghosts for same slot', () => {
    const t1 = makeTask({
      id: 't1',
      title: 'Morning standup',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 9, 0),
      durationMinutes: 30,
    });
    const t2 = makeTask({
      id: 't2',
      title: 'Morning standup dupe',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 9, 0),
      durationMinutes: 30,
    });

    const ghosts = generateGhosts([t1, t2], [], TODAY, WORK_START, WORK_END);
    // Only first one takes the slot
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].title).toBe('Morning standup');
  });

  it('finds last same-weekday tasks when no yesterday tasks exist', () => {
    // Find the same weekday as today, 7 days ago
    const sameWeekday7DaysAgo = addDays(TODAY, -7);

    const task = makeTask({
      id: 't1',
      title: 'Weekly review',
      completedScheduledDate: sameWeekday7DaysAgo,
      completedStartTime: buildUTCTime(sameWeekday7DaysAgo, 14, 0),
      durationMinutes: 60,
    });

    const ghosts = generateGhosts([task], [], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].source).toBe('yesterday');
    expect(ghosts[0].title).toBe('Weekly review');
  });

  it('preserves color and priority from source task', () => {
    const task = makeTask({
      id: 't1',
      color: 'blue',
      priority: 'High',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 11, 0),
      durationMinutes: 90,
    });

    const ghosts = generateGhosts([task], [], TODAY, WORK_START, WORK_END);
    expect(ghosts[0].color).toBe('blue');
    expect(ghosts[0].priority).toBe('High');
  });

  it('returns no ghost for tasks beyond 14-day lookback', () => {
    const oldDate = addDays(TODAY, -15);
    const task = makeTask({
      id: 't1',
      completedScheduledDate: oldDate,
      completedStartTime: buildUTCTime(oldDate, 10, 0),
      durationMinutes: 60,
    });

    const ghosts = generateGhosts([task], [], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(0);
  });

  it('partial overlap with today block also filters the ghost', () => {
    const task = makeTask({
      id: 't1',
      completedScheduledDate: YESTERDAY,
      completedStartTime: buildUTCTime(YESTERDAY, 10, 30),
      durationMinutes: 60, // ghost runs 10:30–11:30
    });

    // Today block at 11:00-12:00 — overlaps ghost tail
    const todayBlock = makeBlock(TODAY, 11, 0, 60);
    const ghosts = generateGhosts([task], [todayBlock], TODAY, WORK_START, WORK_END);
    expect(ghosts).toHaveLength(0);
  });
});
