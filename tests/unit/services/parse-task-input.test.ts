// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { parseTaskInput } from '../../../src/services/parse-task-input';

describe('parseTaskInput()', () => {
  // --- Empty / fallback ---

  it('returns default task for empty string', () => {
    const result = parseTaskInput('');
    expect(result.title).toBe('새 작업');
    expect(result.durationMinutes).toBe(60);
    expect(result.priority).toBe('Medium');
  });

  it('returns default task for whitespace-only string', () => {
    const result = parseTaskInput('   ');
    expect(result.title).toBe('새 작업');
    expect(result.durationMinutes).toBe(60);
    expect(result.priority).toBe('Medium');
  });

  // --- Korean input ---

  it('parses Korean title with duration in minutes', () => {
    const result = parseTaskInput('회의 30m');
    expect(result.title).toBe('회의');
    expect(result.durationMinutes).toBe(30);
    expect(result.priority).toBe('Medium');
  });

  it('parses Korean title with hour duration', () => {
    const result = parseTaskInput('점심 1h');
    expect(result.title).toBe('점심');
    expect(result.durationMinutes).toBe(60);
    expect(result.priority).toBe('Medium');
  });

  it('parses Korean title with Korean low priority', () => {
    const result = parseTaskInput('운동 1h 낮음');
    expect(result.title).toBe('운동');
    expect(result.durationMinutes).toBe(60);
    expect(result.priority).toBe('Low');
  });

  it('parses Korean title with Korean high priority', () => {
    const result = parseTaskInput('발표 준비 2h 높음');
    expect(result.title).toBe('발표 준비');
    expect(result.durationMinutes).toBe(120);
    expect(result.priority).toBe('High');
  });

  // --- English input ---

  it('parses English title with duration and high priority', () => {
    const result = parseTaskInput('보고서 작성 2h high');
    expect(result.title).toBe('보고서 작성');
    expect(result.durationMinutes).toBe(120);
    expect(result.priority).toBe('High');
  });

  it('parses low priority with l shorthand', () => {
    const result = parseTaskInput('이메일 확인 30m l');
    expect(result.title).toBe('이메일 확인');
    expect(result.durationMinutes).toBe(30);
    expect(result.priority).toBe('Low');
  });

  it('parses high priority with h shorthand', () => {
    const result = parseTaskInput('긴급 보고 45m h');
    expect(result.title).toBe('긴급 보고');
    expect(result.durationMinutes).toBe(45);
    expect(result.priority).toBe('High');
  });

  // --- Mixed input ---

  it('parses mixed Korean/English: "보고서 작성 2h high"', () => {
    const result = parseTaskInput('보고서 작성 2h high');
    expect(result.title).toBe('보고서 작성');
    expect(result.durationMinutes).toBe(120);
    expect(result.priority).toBe('High');
  });

  it('parses 1h30m compound duration', () => {
    const result = parseTaskInput('회의 1h30m');
    expect(result.title).toBe('회의');
    expect(result.durationMinutes).toBe(90);
    expect(result.priority).toBe('Medium');
  });

  it('parses 1.5h fractional hour duration', () => {
    const result = parseTaskInput('회의 1.5h');
    expect(result.title).toBe('회의');
    expect(result.durationMinutes).toBe(90);
    expect(result.priority).toBe('Medium');
  });

  it('parses 30min long-form duration', () => {
    const result = parseTaskInput('스트레칭 30min');
    expect(result.title).toBe('스트레칭');
    expect(result.durationMinutes).toBe(30);
    expect(result.priority).toBe('Medium');
  });

  // --- Missing duration fallback ---

  it('defaults duration to 60 when no duration token present', () => {
    const result = parseTaskInput('점심');
    expect(result.title).toBe('점심');
    expect(result.durationMinutes).toBe(60);
    expect(result.priority).toBe('Medium');
  });

  it('defaults duration to 60 for multi-word title without duration', () => {
    const result = parseTaskInput('오후 미팅');
    expect(result.title).toBe('오후 미팅');
    expect(result.durationMinutes).toBe(60);
    expect(result.priority).toBe('Medium');
  });

  // --- Missing priority fallback ---

  it('defaults priority to Medium when no priority token present', () => {
    const result = parseTaskInput('회의 30m');
    expect(result.priority).toBe('Medium');
  });

  // --- XSS safety ---

  it('strips script tags from title', () => {
    const result = parseTaskInput('<script>alert(1)</script> 30m');
    expect(result.title).toBe('새 작업');
    expect(result.durationMinutes).toBe(30);
  });

  it('strips img onerror injection from title', () => {
    const result = parseTaskInput('<img src=x onerror=bad> 1h');
    // DOMPurify strips the tag — title will be empty → falls back to default
    expect(result.title).toBe('새 작업');
    expect(result.durationMinutes).toBe(60);
  });

  it('preserves plain text in title untouched', () => {
    const result = parseTaskInput('코드 리뷰 & 테스트 30m');
    expect(result.title).toContain('코드 리뷰');
    expect(result.durationMinutes).toBe(30);
  });

  // --- Case insensitivity ---

  it('handles uppercase HIGH priority keyword', () => {
    const result = parseTaskInput('발표 30m HIGH');
    expect(result.priority).toBe('High');
  });

  it('handles uppercase LOW priority keyword', () => {
    const result = parseTaskInput('휴식 15m LOW');
    expect(result.priority).toBe('Low');
  });

  // --- Title is always sanitized ---

  it('returns non-empty title for valid input', () => {
    const result = parseTaskInput('할 일');
    expect(result.title).toBe('할 일');
  });
});
