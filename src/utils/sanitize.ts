import DOMPurify from 'dompurify';

/**
 * Strips all HTML tags and attributes, returning plain text.
 * Safe for task titles and descriptions rendered as text content.
 *
 * @param input - Raw user-controlled string (may be empty, null, or undefined).
 * @returns Sanitized plain-text string; empty string for falsy input.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Allows a small whitelist of inline formatting tags (b, i, em, strong, br)
 * while stripping all attributes and all other tags.
 *
 * @param input - Raw user-controlled string (may be empty, null, or undefined).
 * @returns Sanitized HTML string; empty string for falsy input.
 */
export function sanitizeInlineHtml(input: string | null | undefined): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Truncates a string to at most `max` characters, appending an ellipsis if cut.
 * Does not alter content when the string is within the limit.
 *
 * @param input - String to truncate.
 * @param max   - Maximum allowed character count (inclusive).
 * @returns Truncated string, or the original if already within bounds.
 */
export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}
