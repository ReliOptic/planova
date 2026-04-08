/**
 * AppError — discriminated union for all application-level errors.
 * Each variant carries structured context for logging and recovery.
 */
export type AppError =
  | RepoNotFoundError
  | RepoWriteFailedError
  | RepoSchemaMismatchError
  | ValidationInvalidFieldError;

/** A document with the given id was not found in the repository. */
export interface RepoNotFoundError {
  readonly kind: 'repo/not-found';
  readonly id: string;
}

/** A write operation failed in the repository layer. */
export interface RepoWriteFailedError {
  readonly kind: 'repo/write-failed';
  readonly cause: string;
}

/** Stored document schema version does not match the expected version. */
export interface RepoSchemaMismatchError {
  readonly kind: 'repo/schema-mismatch';
  /** The schema version found in the stored document. */
  readonly have: number;
  /** The schema version the application requires. */
  readonly want: number;
}

/** A field value failed domain validation. */
export interface ValidationInvalidFieldError {
  readonly kind: 'validation/invalid-field';
  readonly field: string;
  readonly reason: string;
}

// ── type guards ──────────────────────────────────────────────────────────────

/** @returns true if error is a RepoNotFoundError */
export function isRepoNotFound(e: AppError): e is RepoNotFoundError {
  return e.kind === 'repo/not-found';
}

/** @returns true if error is a RepoWriteFailedError */
export function isRepoWriteFailed(e: AppError): e is RepoWriteFailedError {
  return e.kind === 'repo/write-failed';
}

/** @returns true if error is a RepoSchemaMismatchError */
export function isRepoSchemaMismatch(e: AppError): e is RepoSchemaMismatchError {
  return e.kind === 'repo/schema-mismatch';
}

/** @returns true if error is a ValidationInvalidFieldError */
export function isValidationInvalidField(e: AppError): e is ValidationInvalidFieldError {
  return e.kind === 'validation/invalid-field';
}
