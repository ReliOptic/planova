import { beforeEach, describe, expect, it } from 'vitest';
import { PlanovaDatabase } from '../../../../src/infrastructure/persistence/db';
import { DexieRingBufferLogger } from '../../../../src/infrastructure/logger/logger';

let db: PlanovaDatabase;
let logger: DexieRingBufferLogger;

beforeEach(async () => {
  db = new PlanovaDatabase('test-logger-' + Math.random());
  await db.open();
  logger = new DexieRingBufferLogger(db, 5);
});

/** Wait for all pending fire-and-forget Dexie operations to settle. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('DexieRingBufferLogger', () => {
  describe('write and persist', () => {
    it('persists an info entry to db.logs', async () => {
      logger.info('test/scope', 'hello world', { key: 'value' });
      await flush();

      const entries = await db.logs.toArray();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
      expect(entries[0].scope).toBe('test/scope');
      expect(entries[0].message).toBe('hello world');
      expect(entries[0].context).toEqual({ key: 'value' });
    });

    it('persists warn and error entries', async () => {
      logger.warn('test/scope', 'a warning');
      logger.error('test/scope', 'an error');
      await flush();

      const entries = await db.logs.orderBy('ts').toArray();
      expect(entries.map((e) => e.level)).toEqual(['warn', 'error']);
    });

    it('assigns a numeric id to each entry', async () => {
      logger.info('test/scope', 'first');
      logger.info('test/scope', 'second');
      await flush();

      const entries = await db.logs.toArray();
      expect(entries.every((e) => typeof e.id === 'number')).toBe(true);
    });
  });

  describe('ring buffer eviction', () => {
    it('evicts oldest entries when count exceeds maxEntries', async () => {
      // maxEntries is 5; writing 6 should evict the oldest
      for (let i = 0; i < 6; i++) {
        logger.info('test/scope', `message-${i}`);
        // small delay to ensure sequential inserts
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await flush();

      const entries = await db.logs.orderBy('id').toArray();
      expect(entries.length).toBeLessThanOrEqual(5);
      // The oldest (message-0) should have been evicted
      expect(entries.some((e) => e.message === 'message-0')).toBe(false);
      expect(entries.some((e) => e.message === 'message-5')).toBe(true);
    });
  });

  describe('listRecent', () => {
    it('returns entries ordered by ts descending', async () => {
      logger.info('test/scope', 'first');
      await new Promise((resolve) => setTimeout(resolve, 5));
      logger.info('test/scope', 'second');
      await new Promise((resolve) => setTimeout(resolve, 5));
      logger.info('test/scope', 'third');
      await flush();

      const entries = await logger.listRecent(10);
      expect(entries[0].message).toBe('third');
      expect(entries[entries.length - 1].message).toBe('first');
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 4; i++) {
        logger.info('test/scope', `msg-${i}`);
      }
      await flush();

      const entries = await logger.listRecent(2);
      expect(entries).toHaveLength(2);
    });

    it('returns empty array when no entries exist', async () => {
      const entries = await logger.listRecent();
      expect(entries).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('deletes all log entries', async () => {
      logger.info('test/scope', 'one');
      logger.info('test/scope', 'two');
      await flush();

      await logger.clear();

      const entries = await db.logs.toArray();
      expect(entries).toHaveLength(0);
    });
  });
});
