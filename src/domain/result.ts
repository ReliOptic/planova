/**
 * Result<T, E> — a discriminated union for typed error handling.
 * Use instead of throwing exceptions on all fallible operations.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Construct a successful Result.
 * @param value — the success value
 */
export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/**
 * Construct a failed Result.
 * @param error — the error value
 */
export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

/**
 * Narrow a Result to its success branch.
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

/**
 * Narrow a Result to its failure branch.
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}
