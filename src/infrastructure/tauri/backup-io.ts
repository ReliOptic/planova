import { ok, err, type Result } from '../../domain/result';
import type { AppError } from '../../domain/errors';
import { isBackupBundle, type BackupBundle } from '../../domain/backup-bundle';

/** Returns true when running inside a Tauri WebView (IPC bridge present). */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Tauri-native backup I/O with graceful fallback.
 *
 * When running inside Tauri, uses the native file dialog + fs plugin.
 * When running in a plain browser (`npm run dev`), returns a clear error
 * so the UI can show a toast instead of crashing.
 */

/** Default suggested filename for an export, stamped with today's date. */
function defaultExportName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `planova-backup-${date}.json`;
}

/**
 * Serialize `bundle`, show a native "Save As" dialog, and write the result.
 *
 * @returns ok(path) with the written absolute path, ok(null) if the user
 *          cancelled the dialog, or err(AppError) on serialization / write
 *          failure.
 */
const NOT_IN_TAURI: AppError = {
  kind: 'repo/write-failed',
  cause: 'Tauri 런타임에서만 사용할 수 있습니다. npm run tauri:dev 로 실행하세요.',
};

export async function exportBackupViaDialog(
  bundle: BackupBundle,
): Promise<Result<string | null, AppError>> {
  if (!isTauriEnvironment()) return err(NOT_IN_TAURI);

  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');

  let contents: string;
  try {
    contents = JSON.stringify(bundle, null, 2);
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return err({ kind: 'repo/write-failed', cause: `serialize failed: ${cause}` });
  }

  let path: string | null;
  try {
    path = await save({
      title: 'Export Planova backup',
      defaultPath: defaultExportName(),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return err({ kind: 'repo/write-failed', cause: `save dialog failed: ${cause}` });
  }

  if (path === null) return ok(null);

  try {
    await writeTextFile(path, contents);
    return ok(path);
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return err({ kind: 'repo/write-failed', cause: `write failed: ${cause}` });
  }
}

export async function importBackupViaDialog(): Promise<Result<BackupBundle | null, AppError>> {
  if (!isTauriEnvironment()) return err(NOT_IN_TAURI);

  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');

  let selection: string | string[] | null;
  try {
    selection = await open({
      title: 'Import Planova backup',
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return err({ kind: 'repo/write-failed', cause: `open dialog failed: ${cause}` });
  }

  if (selection === null) return ok(null);
  const path = Array.isArray(selection) ? selection[0] : selection;
  if (path === undefined) return ok(null);

  let text: string;
  try {
    text = await readTextFile(path);
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return err({ kind: 'repo/write-failed', cause: `read failed: ${cause}` });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return err({ kind: 'repo/write-failed', cause: `JSON parse error: ${cause}` });
  }

  if (!isBackupBundle(parsed)) {
    return err({ kind: 'repo/write-failed', cause: 'not a valid Planova backup file' });
  }

  return ok(parsed);
}
