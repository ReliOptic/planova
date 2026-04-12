import { type Priority } from '../domain/task';
import { parseDuration } from '../utils/date-utils';
import { sanitizeText } from '../utils/sanitize';

export interface ParsedTaskInput {
  title: string;
  durationMinutes: number;
  priority: Priority;
}

/**
 * Duration token pattern — matches tokens like 30m, 1h, 1h30m, 1.5h, 30min, 1hr.
 * Uses a word-boundary-like approach: token must be preceded by whitespace or start-of-string.
 */
const DURATION_TOKEN_RE =
  /(?:^|\s)(\d+(?:\.\d+)?h(?:r|rs|our|ours)?(?:\s*\d+m(?:in|ins)?)?|\d+m(?:in|ins)?|\d+(?:\.\d+)?h(?:r|rs|our|ours)?)(?=\s|$)/i;

/**
 * Priority token pattern — English and Korean keywords.
 * Must appear as a standalone token (whitespace-bounded).
 */
const PRIORITY_HIGH_RE = /(?:^|\s)(high|h|높음)(?=\s|$)/i;
const PRIORITY_LOW_RE = /(?:^|\s)(low|l|낮음)(?=\s|$)/i;

/**
 * Extracts the duration token string from raw input, or null if none found.
 */
function extractDurationToken(input: string): string | null {
  const match = DURATION_TOKEN_RE.exec(input);
  if (!match) return null;
  return match[1];
}

/**
 * Extracts the priority from raw input, or null if none found.
 */
function extractPriority(input: string): Priority | null {
  if (PRIORITY_HIGH_RE.test(input)) return 'High';
  if (PRIORITY_LOW_RE.test(input)) return 'Low';
  return null;
}

/**
 * Removes a matched token from the input string and collapses extra whitespace.
 */
function removeToken(input: string, token: string): string {
  // Remove the token (case-insensitive, surrounded by optional spaces)
  return input.replace(new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?=\\s|$)`, 'i'), ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a natural-language task string into structured task fields.
 *
 * Pattern: "[title] [duration?] [priority?]"
 *
 * Duration examples: 30m, 1h, 1h30m, 1.5h, 30min → minutes
 * Priority examples: high/h/높음 → High, low/l/낮음 → Low
 * Fallbacks: no duration → 60min, no priority → Medium, empty → title "새 작업"
 *
 * @param input - Raw user input string
 * @returns ParsedTaskInput with sanitized title, durationMinutes, and priority
 */
export function parseTaskInput(input: string): ParsedTaskInput {
  const raw = input.trim();

  if (!raw) {
    return { title: '새 작업', durationMinutes: 60, priority: 'Medium' };
  }

  let remaining = raw;

  // Extract and remove duration token
  const durationToken = extractDurationToken(remaining);
  let durationMinutes = 60;
  if (durationToken !== null) {
    const parsed = parseDuration(durationToken);
    if (parsed > 0) {
      durationMinutes = parsed;
    }
    remaining = removeToken(remaining, durationToken);
  }

  // Extract and remove priority token
  const priority = extractPriority(remaining) ?? 'Medium';
  if (priority === 'High') {
    remaining = remaining.replace(PRIORITY_HIGH_RE, ' ').trim();
  } else if (priority === 'Low') {
    remaining = remaining.replace(PRIORITY_LOW_RE, ' ').trim();
  }

  // Collapse multiple spaces and trim
  const titleRaw = remaining.replace(/\s{2,}/g, ' ').trim();
  const title = sanitizeText(titleRaw) || '새 작업';

  return { title, durationMinutes, priority };
}
