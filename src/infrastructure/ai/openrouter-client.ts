import type { AiError } from '../../domain/ai-errors';
import { ok, err } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { IAiCredentialRepository } from '../persistence/ai-credential-repository';
import { buildCacheKey, DexieResponseCache } from './response-cache';
import type { TokenBucketRateLimiter } from './rate-limiter';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 512;

/** Parameters for a single completion request. */
export interface OpenRouterRequest {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}

/** Shape of a successful OpenRouter chat completion response. */
interface OpenRouterResponse {
  readonly choices: ReadonlyArray<{
    readonly message: {
      readonly content: string;
    };
  }>;
}

function isOpenRouterResponse(value: unknown): value is OpenRouterResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v['choices']) || v['choices'].length === 0) return false;
  const first = v['choices'][0] as Record<string, unknown>;
  if (typeof first !== 'object' || first === null) return false;
  const msg = first['message'] as Record<string, unknown> | undefined;
  return typeof msg?.['content'] === 'string';
}

/**
 * OpenRouterClient — sends chat completion requests to openrouter.ai.
 *
 * Respects rate limits, serves cache hits, and degrades silently when
 * no credential is configured.
 */
export class OpenRouterClient {
  constructor(
    private readonly _credRepo: IAiCredentialRepository,
    private readonly _cache: DexieResponseCache,
    private readonly _limiter: TokenBucketRateLimiter,
  ) {}

  /**
   * Send a prompt and return the model's response text.
   *
   * @returns ok(content) on success, err(AiError) on any failure.
   */
  async complete(req: OpenRouterRequest): Promise<Result<string, AiError>> {
    if (!navigator.onLine) {
      return err<AiError>({ kind: 'ai/offline' });
    }

    const credResult = await this._credRepo.get();
    if (!credResult.ok || credResult.value === null || credResult.value.apiKey.trim() === '') {
      return err<AiError>({ kind: 'ai/no-key' });
    }
    const credential = credResult.value;

    const cacheKey = await buildCacheKey(credential.model, req.prompt);
    const cached = await this._cache.get(cacheKey);
    if (cached !== null) {
      return ok(cached);
    }

    const acquireResult = this._limiter.tryAcquire();
    if (!acquireResult.ok) {
      return err<AiError>({
        kind: 'ai/rate-limited',
        retryAfterMs: acquireResult.retryAfterMs,
      });
    }

    return this._fetchCompletion(req, credential.model, credential.apiKey, cacheKey);
  }

  private async _fetchCompletion(
    req: OpenRouterRequest,
    model: string,
    apiKey: string,
    cacheKey: string,
  ): Promise<Result<string, AiError>> {
    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: req.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': location.origin,
          'X-Title': 'Planova',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        }),
      });
    } catch (cause) {
      console.error(
        JSON.stringify({ level: 'error', op: 'openrouter.fetch', cause: String(cause) }),
      );
      return err<AiError>({ kind: 'ai/offline' });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(
        JSON.stringify({ level: 'error', op: 'openrouter.http', status: response.status, body }),
      );
      return err<AiError>({ kind: 'ai/http', status: response.status, body });
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (cause) {
      console.error(
        JSON.stringify({ level: 'error', op: 'openrouter.parse', cause: String(cause) }),
      );
      return err<AiError>({ kind: 'ai/invalid-response', reason: 'Response body is not valid JSON' });
    }

    if (!isOpenRouterResponse(parsed)) {
      console.error(
        JSON.stringify({ level: 'error', op: 'openrouter.shape', parsed: JSON.stringify(parsed) }),
      );
      return err<AiError>({
        kind: 'ai/invalid-response',
        reason: 'Unexpected response shape from OpenRouter',
      });
    }

    const content = parsed.choices[0].message.content;
    await this._cache.set(cacheKey, content).catch(() => {
      // best-effort cache write; do not fail the request
    });

    return ok(content);
  }
}
