import type { AppError } from '../../domain/errors';
import { ok, err, type Result } from '../../domain/result';
import type { AiCredential } from '../../domain/ai-credential';
import type { IAiCredentialRepository } from '../persistence/ai-credential-repository';
import { isTauriEnvironment } from './backup-io';

const VAULT_FILENAME = 'planova-vault.hold';
const VAULT_PASSWORD = 'planova-local-vault';
const CLIENT_NAME = 'planova';
const STORE_KEY = 'openrouter-credential';

/**
 * StrongholdCredentialRepository — stores the API key in an encrypted
 * Stronghold vault instead of plaintext IndexedDB.
 *
 * Falls back to returning null (not erroring) when not in Tauri.
 */
export class StrongholdCredentialRepository implements IAiCredentialRepository {
  private async _getStore() {
    const { Stronghold, Store } = await import('@tauri-apps/plugin-stronghold');
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    const dir = await appDataDir();
    const path = await join(dir, VAULT_FILENAME);
    const stronghold = await Stronghold.load(path, VAULT_PASSWORD);

    // Ensure the client exists
    try {
      await stronghold.loadClient(CLIENT_NAME);
    } catch {
      await stronghold.createClient(CLIENT_NAME);
    }

    return { store: new Store(path, CLIENT_NAME), stronghold };
  }

  async get(): Promise<Result<AiCredential | null, AppError>> {
    if (!isTauriEnvironment()) return ok(null);
    try {
      const { store } = await this._getStore();
      const data = await store.get(STORE_KEY);
      if (!data || data.length === 0) return ok(null);
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text) as AiCredential;
      return ok(parsed);
    } catch (cause) {
      console.error(JSON.stringify({ level: 'error', op: 'stronghold.get', cause: String(cause) }));
      return ok(null);
    }
  }

  async save(credential: AiCredential): Promise<Result<void, AppError>> {
    if (!isTauriEnvironment()) {
      return err({ kind: 'repo/write-failed', cause: 'Stronghold requires Tauri runtime' });
    }
    try {
      const { store } = await this._getStore();
      const data = Array.from(new TextEncoder().encode(JSON.stringify(credential)));
      await store.insert(STORE_KEY, data);
      return ok(undefined);
    } catch (cause) {
      console.error(JSON.stringify({ level: 'error', op: 'stronghold.save', cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }

  async clear(): Promise<Result<void, AppError>> {
    if (!isTauriEnvironment()) return ok(undefined);
    try {
      const { store } = await this._getStore();
      await store.remove(STORE_KEY);
      return ok(undefined);
    } catch (cause) {
      console.error(JSON.stringify({ level: 'error', op: 'stronghold.clear', cause: String(cause) }));
      return err({ kind: 'repo/write-failed', cause: String(cause) });
    }
  }
}

/**
 * Migrate an existing plaintext credential from IndexedDB to Stronghold.
 * Called once on app startup. If IndexedDB has a credential and Stronghold
 * does not, moves it over and clears the IndexedDB entry.
 */
export async function migrateCredentialToStronghold(
  dexieRepo: IAiCredentialRepository,
  strongholdRepo: IAiCredentialRepository,
): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const existing = await strongholdRepo.get();
    if (existing.ok && existing.value !== null) return;

    const legacy = await dexieRepo.get();
    if (!legacy.ok || legacy.value === null) return;

    const saveResult = await strongholdRepo.save(legacy.value);
    if (saveResult.ok) {
      await dexieRepo.clear();
      console.log(JSON.stringify({ level: 'info', op: 'stronghold.migrate', status: 'success' }));
    }
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', op: 'stronghold.migrate', cause: String(e) }));
  }
}
