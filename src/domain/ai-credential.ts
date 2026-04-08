import type { AppError } from './errors';
import { ok, err } from './result';
import type { Result } from './result';

/**
 * AiCredential — user-supplied OpenRouter credential.
 *
 * WARNING: The apiKey is stored PLAINTEXT in IndexedDB.
 * Do not use on shared or public devices.
 */
export interface AiCredential {
  readonly provider: 'openrouter';
  /** PLAINTEXT API key — see security warning above. */
  readonly apiKey: string;
  /** Model ID as supplied by the user, e.g. "mistralai/mistral-small-latest". */
  readonly model: string;
  readonly schemaVersion: 2;
}

interface AiCredentialInput {
  readonly apiKey: string;
  readonly model: string;
}

/**
 * Factory that validates and constructs an AiCredential.
 *
 * @returns ok(credential) if both fields are non-empty,
 *          err(validation/invalid-field) otherwise.
 */
export function createAiCredential(
  input: AiCredentialInput,
): Result<AiCredential, AppError> {
  const trimmedKey = input.apiKey.trim();
  if (trimmedKey.length === 0) {
    return err<AppError>({
      kind: 'validation/invalid-field',
      field: 'apiKey',
      reason: 'API key must not be empty',
    });
  }

  const trimmedModel = input.model.trim();
  if (trimmedModel.length === 0) {
    return err<AppError>({
      kind: 'validation/invalid-field',
      field: 'model',
      reason: 'Model ID must not be empty',
    });
  }

  return ok<AiCredential>({
    provider: 'openrouter',
    apiKey: trimmedKey,
    model: trimmedModel,
    schemaVersion: 2,
  });
}
