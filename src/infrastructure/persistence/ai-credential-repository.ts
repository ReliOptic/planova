import type { AppError } from '../../domain/errors';
import { ok, err } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { AiCredential } from '../../domain/ai-credential';
import type { PlanovaDatabase } from './db';

/** Contract for storing and retrieving the single OpenRouter credential. */
export interface IAiCredentialRepository {
  /** Returns the stored credential, or null if none has been saved. */
  get(): Promise<Result<AiCredential | null, AppError>>;
  /** Persists the credential (upsert by provider key). */
  save(credential: AiCredential): Promise<Result<void, AppError>>;
  /** Removes the credential from storage. */
  clear(): Promise<Result<void, AppError>>;
}

/**
 * DexieAiCredentialRepository — IndexedDB-backed implementation.
 *
 * There is at most one row (provider = 'openrouter').
 */
export class DexieAiCredentialRepository implements IAiCredentialRepository {
  constructor(private readonly _db: PlanovaDatabase) {}

  /** @inheritdoc */
  async get(): Promise<Result<AiCredential | null, AppError>> {
    try {
      const credential = await this._db.aiCredentials.get('openrouter');
      return ok(credential ?? null);
    } catch (cause) {
      console.error(
        JSON.stringify({ level: 'error', op: 'aiCredential.get', cause: String(cause) }),
      );
      return err<AppError>({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** @inheritdoc */
  async save(credential: AiCredential): Promise<Result<void, AppError>> {
    try {
      await this._db.aiCredentials.put(credential);
      return ok(undefined);
    } catch (cause) {
      console.error(
        JSON.stringify({ level: 'error', op: 'aiCredential.save', cause: String(cause) }),
      );
      return err<AppError>({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  /** @inheritdoc */
  async clear(): Promise<Result<void, AppError>> {
    try {
      await this._db.aiCredentials.delete('openrouter');
      return ok(undefined);
    } catch (cause) {
      console.error(
        JSON.stringify({ level: 'error', op: 'aiCredential.clear', cause: String(cause) }),
      );
      return err<AppError>({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }
}
