import { ok, err, type Result } from '../domain/result';
import type { AppError } from '../domain/errors';

/**
 * Triggers a browser download of JSON data as a `.json` file.
 *
 * @param filename - Suggested filename for the download (e.g. `planova-backup-2026-04-08.json`).
 * @param data - Value to serialize as JSON.
 */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a `File` as text and parses it as JSON.
 *
 * @param file - The File object from an `<input type="file">` element.
 * @returns ok(unknown) with the parsed value, or err(AppError) on read/parse failure.
 */
export function readJsonFile(file: File): Promise<Result<unknown, AppError>> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result;
      if (typeof text !== 'string') {
        resolve(err({ kind: 'repo/write-failed', cause: 'FileReader returned non-string result' }));
        return;
      }
      try {
        const parsed: unknown = JSON.parse(text);
        resolve(ok(parsed));
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        resolve(err({ kind: 'repo/write-failed', cause: `JSON parse error: ${reason}` }));
      }
    };

    reader.onerror = () => {
      const cause = reader.error?.message ?? 'unknown FileReader error';
      resolve(err({ kind: 'repo/write-failed', cause }));
    };

    reader.readAsText(file);
  });
}
