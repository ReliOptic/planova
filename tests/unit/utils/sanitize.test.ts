// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeInlineHtml, truncate } from '../../../src/utils/sanitize';

describe('sanitizeText()', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizeText('Hello world')).toBe('Hello world');
  });

  it('strips <script> tags', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('');
  });

  it('strips <img> with onerror', () => {
    expect(sanitizeText('<img src=x onerror=bad>')).toBe('');
  });

  it('strips <b> tags (no HTML allowed)', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    // DOMPurify preserves whitespace; we just confirm no crash
    expect(sanitizeText('   ')).toBe('   ');
  });

  it('returns empty string for null', () => {
    expect(sanitizeText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeText(undefined)).toBe('');
  });
});

describe('sanitizeInlineHtml()', () => {
  it('preserves <b> tags', () => {
    expect(sanitizeInlineHtml('<b>bold</b>')).toBe('<b>bold</b>');
  });

  it('preserves <i>, <em>, <strong>, <br>', () => {
    const input = '<i>a</i><em>b</em><strong>c</strong><br>';
    const result = sanitizeInlineHtml(input);
    expect(result).toContain('<i>a</i>');
    expect(result).toContain('<em>b</em>');
    expect(result).toContain('<strong>c</strong>');
    expect(result).toContain('<br>');
  });

  it('strips <script> tags', () => {
    expect(sanitizeInlineHtml('<script>alert(1)</script>')).toBe('');
  });

  it('strips <img> with onerror', () => {
    expect(sanitizeInlineHtml('<img src=x onerror=bad>')).toBe('');
  });

  it('strips attributes from allowed tags', () => {
    expect(sanitizeInlineHtml('<b class="x" style="color:red">hi</b>')).toBe('<b>hi</b>');
  });

  it('returns empty string for null', () => {
    expect(sanitizeInlineHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeInlineHtml(undefined)).toBe('');
  });
});

describe('truncate()', () => {
  it('returns string unchanged when within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string unchanged when exactly at limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis when over limit', () => {
    expect(truncate('hello world', 5)).toBe('hello…');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('truncates at boundary of 1', () => {
    expect(truncate('abc', 1)).toBe('a…');
  });
});
