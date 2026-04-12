import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { ok, err, type Result } from '../../domain/result';
import type { AppError } from '../../domain/errors';
import { isBackupBundle, type BackupBundle } from '../../domain/backup-bundle';

/**
 * Tauri-native backup I/O.
 *
 * Uses the system file dialog to pick a path, then the fs plugin to read or
 * write the JSON contents. There is intentionally no web fallback: the app
 * is a Tauri-only desktop target.
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
export async function exportBackupViaDialog(
  bundle: BackupBundle,
): Promise<Result<string | null, AppError>> {
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

/**
 * Show a native "Open File" dialog, read the selected JSON, and validate it
 * as a BackupBundle.
 *
 * @returns ok(bundle) on success, ok(null) if the user cancelled, or
 *          err(AppError) on read / parse / validation failure.
 */
export async function importBackupViaDialog(): Promise<Result<BackupBundle | null, AppError>> {
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
