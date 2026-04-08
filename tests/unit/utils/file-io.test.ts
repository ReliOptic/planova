import { describe, it, expect } from 'vitest';
import { readJsonFile } from '../../../src/utils/file-io';

function makeFile(content: string, name = 'test.json', type = 'application/json'): File {
  return new File([content], name, { type });
}

describe('readJsonFile()', () => {
  it('parses a valid JSON object', async () => {
    const file = makeFile('{"key":"value","num":42}');
    const result = await readJsonFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ key: 'value', num: 42 });
    }
  });

  it('parses a valid JSON array', async () => {
    const file = makeFile('[1,2,3]');
    const result = await readJsonFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  it('parses a nested JSON object', async () => {
    const payload = { format: 'planova-backup', tasks: [], scheduleBlocks: [] };
    const file = makeFile(JSON.stringify(payload));
    const result = await readJsonFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { format: string }).format).toBe('planova-backup');
    }
  });

  it('returns err for invalid JSON', async () => {
    const file = makeFile('not valid json{{{');
    const result = await readJsonFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('repo/write-failed');
    }
  });

  it('returns err for empty file', async () => {
    const file = makeFile('');
    const result = await readJsonFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('repo/write-failed');
    }
  });

  it('returns err for whitespace-only content', async () => {
    const file = makeFile('   ');
    const result = await readJsonFile(file);
    expect(result.ok).toBe(false);
  });

  it('parses a JSON number at top level', async () => {
    const file = makeFile('123');
    const result = await readJsonFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(123);
    }
  });
});
