/**
 * Backup-specific error types, separate from the shared AppError union.
 * Import and use via BackupError in backup-service.ts.
 */

/** The imported file is not a valid BackupBundle. */
export interface BackupInvalidBundleError {
  readonly kind: 'backup/invalid-bundle';
  readonly reason: string;
}

/** A read or write operation on the database failed during backup/restore. */
export interface BackupIoFailedError {
  readonly kind: 'backup/io-failed';
  readonly cause: string;
}

/** Discriminated union of all backup-domain errors. */
export type BackupError = BackupInvalidBundleError | BackupIoFailedError;

/** @returns true if error is BackupInvalidBundleError */
export function isBackupInvalidBundle(e: BackupError): e is BackupInvalidBundleError {
  return e.kind === 'backup/invalid-bundle';
}

/** @returns true if error is BackupIoFailedError */
export function isBackupIoFailed(e: BackupError): e is BackupIoFailedError {
  return e.kind === 'backup/io-failed';
}
