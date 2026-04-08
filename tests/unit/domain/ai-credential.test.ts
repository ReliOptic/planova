import { describe, expect, it } from 'vitest';
import { createAiCredential } from '../../../src/domain/ai-credential';

describe('createAiCredential', () => {
  describe('valid inputs', () => {
    it('returns ok with a valid key and model', () => {
      const result = createAiCredential({
        apiKey: 'sk-or-v1-abc123',
        model: 'mistralai/mistral-small-latest',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe('openrouter');
        expect(result.value.apiKey).toBe('sk-or-v1-abc123');
        expect(result.value.model).toBe('mistralai/mistral-small-latest');
        expect(result.value.schemaVersion).toBe(2);
      }
    });

    it('trims whitespace from apiKey and model', () => {
      const result = createAiCredential({
        apiKey: '  sk-or-v1-abc  ',
        model: '  gpt-4o  ',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.apiKey).toBe('sk-or-v1-abc');
        expect(result.value.model).toBe('gpt-4o');
      }
    });
  });

  describe('empty apiKey', () => {
    it('returns err with validation/invalid-field for empty string', () => {
      const result = createAiCredential({ apiKey: '', model: 'some-model' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('apiKey');
        }
      }
    });

    it('returns err for whitespace-only apiKey', () => {
      const result = createAiCredential({ apiKey: '   ', model: 'some-model' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
      }
    });
  });

  describe('empty model', () => {
    it('returns err with validation/invalid-field for empty string', () => {
      const result = createAiCredential({ apiKey: 'sk-or-valid', model: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
        if (result.error.kind === 'validation/invalid-field') {
          expect(result.error.field).toBe('model');
        }
      }
    });

    it('returns err for whitespace-only model', () => {
      const result = createAiCredential({ apiKey: 'sk-or-valid', model: '   ' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation/invalid-field');
      }
    });
  });

  describe('apiKey validation takes precedence', () => {
    it('returns apiKey error when both are empty', () => {
      const result = createAiCredential({ apiKey: '', model: '' });
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.kind === 'validation/invalid-field') {
        expect(result.error.field).toBe('apiKey');
      }
    });
  });
});
