import { db } from '../infrastructure/persistence/db';
import { DexieTaskRepository } from '../infrastructure/persistence/task-repository';
import { DexieScheduleBlockRepository } from '../infrastructure/persistence/schedule-block-repository';
import { DexieAiCredentialRepository } from '../infrastructure/persistence/ai-credential-repository';
import { DexieResponseCache } from '../infrastructure/ai/response-cache';
import { TokenBucketRateLimiter } from '../infrastructure/ai/rate-limiter';
import { OpenRouterClient } from '../infrastructure/ai/openrouter-client';
import { DexieRingBufferLogger } from '../infrastructure/logger/logger';
import { isTauriEnvironment } from '../infrastructure/tauri/backup-io';
import { StrongholdCredentialRepository } from '../infrastructure/tauri/stronghold-credential-repository';
import type { IAiCredentialRepository } from '../infrastructure/persistence/ai-credential-repository';

/** Singleton task repository backed by IndexedDB (Dexie). */
export const taskRepository = new DexieTaskRepository(db);

/** Singleton schedule-block repository backed by IndexedDB (Dexie). */
export const scheduleBlockRepository = new DexieScheduleBlockRepository(db);

/** Legacy IndexedDB credential repository (used for migration). */
export const dexieAiCredentialRepository = new DexieAiCredentialRepository(db);

/** Active AI credential repository — Stronghold when in Tauri, IndexedDB otherwise. */
export const aiCredentialRepository: IAiCredentialRepository = isTauriEnvironment()
  ? new StrongholdCredentialRepository()
  : dexieAiCredentialRepository;

/** Singleton AI response cache backed by IndexedDB (Dexie). */
export const aiResponseCache = new DexieResponseCache(db);

/** Singleton rate limiter — 10 requests per 10 minutes, in-memory. */
export const aiRateLimiter = new TokenBucketRateLimiter({ capacity: 10, refillMs: 600_000 });

/** Singleton OpenRouter client wiring credential, cache, and rate limiter. */
export const openRouterClient = new OpenRouterClient(
  aiCredentialRepository,
  aiResponseCache,
  aiRateLimiter,
);

/** Singleton structured logger with IndexedDB ring buffer (max 500 entries). */
export const logger = new DexieRingBufferLogger(db, 500);
