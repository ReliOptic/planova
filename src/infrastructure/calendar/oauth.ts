import { ok, err, type Result } from '../../domain/result';
import type { AppError } from '../../domain/errors';
import { db } from '../persistence/db';
import { isTauriEnvironment } from '../tauri/backup-io';

export type CalendarProvider = 'google' | 'microsoft';

export interface OAuthTokens {
  readonly provider: CalendarProvider;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number; // Unix epoch ms
  readonly email?: string;
}

const META_KEY_PREFIX = 'cal:oauth:';

function metaKey(provider: CalendarProvider): string {
  return `${META_KEY_PREFIX}${provider}`;
}

/** Store OAuth tokens in the meta table. */
export async function saveTokens(tokens: OAuthTokens): Promise<Result<void, AppError>> {
  try {
    await db.meta.put({ key: metaKey(tokens.provider), value: JSON.stringify(tokens) });
    return ok(undefined);
  } catch (e) {
    return err({ kind: 'repo/write-failed', cause: String(e) });
  }
}

/** Load OAuth tokens for a given provider. */
export async function loadTokens(provider: CalendarProvider): Promise<OAuthTokens | null> {
  try {
    const row = await db.meta.get(metaKey(provider));
    if (!row || typeof row.value !== 'string') return null;
    return JSON.parse(row.value) as OAuthTokens;
  } catch {
    return null;
  }
}

/** Clear stored tokens (disconnect). */
export async function clearTokens(provider: CalendarProvider): Promise<void> {
  try {
    await db.meta.delete(metaKey(provider));
  } catch {
    // best-effort
  }
}

/** Check if tokens exist and are not expired. */
export async function isConnected(provider: CalendarProvider): Promise<boolean> {
  const tokens = await loadTokens(provider);
  if (!tokens) return false;
  return tokens.expiresAt > Date.now();
}

/**
 * OAuth configuration per provider.
 * Client IDs must be set in Settings before connecting.
 */
export interface OAuthConfig {
  readonly clientId: string;
  readonly clientSecret?: string; // Optional for public clients (Google uses PKCE)
}

/** Load OAuth config from localStorage. */
export function loadOAuthConfig(provider: CalendarProvider): OAuthConfig | null {
  try {
    const raw = localStorage.getItem(`planova-oauth-${provider}`);
    if (!raw) return null;
    return JSON.parse(raw) as OAuthConfig;
  } catch {
    return null;
  }
}

/** Save OAuth config to localStorage. */
export function saveOAuthConfig(provider: CalendarProvider, config: OAuthConfig): void {
  localStorage.setItem(`planova-oauth-${provider}`, JSON.stringify(config));
}

/**
 * Start the OAuth flow by opening the provider's consent screen.
 *
 * For desktop apps, we use the "loopback" redirect flow:
 * 1. Open the auth URL in the system browser
 * 2. The redirect lands on http://localhost:{port}
 * 3. Tauri captures the code from the URL
 *
 * Returns the authorization code for token exchange.
 */
export async function startOAuthFlow(
  provider: CalendarProvider,
  config: OAuthConfig,
): Promise<Result<string, AppError>> {
  if (!isTauriEnvironment()) {
    return err({ kind: 'repo/write-failed', cause: 'OAuth는 Tauri 환경에서만 사용 가능합니다.' });
  }

  const redirectUri = 'http://localhost:19871/oauth/callback';

  let authUrl: string;
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      prompt: 'consent',
    });
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  } else {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'Calendars.Read offline_access',
    });
    authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  }

  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(authUrl);
    // The actual code capture is handled by the Tauri backend
    // (a one-shot HTTP server on port 19871).
    // For now, return a placeholder — the full flow requires
    // Rust-side HTTP server which we'll add as a Tauri command.
    return ok('pending');
  } catch (e) {
    return err({ kind: 'repo/write-failed', cause: `OAuth 시작 실패: ${String(e)}` });
  }
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  provider: CalendarProvider,
  code: string,
  config: OAuthConfig,
): Promise<Result<OAuthTokens, AppError>> {
  const redirectUri = 'http://localhost:19871/oauth/callback';

  let tokenUrl: string;
  let body: URLSearchParams;

  if (provider === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    body = new URLSearchParams({
      code,
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
  } else {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    body = new URLSearchParams({
      code,
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'Calendars.Read offline_access',
    });
  }

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      return err({ kind: 'repo/write-failed', cause: `Token exchange failed: ${text}` });
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const tokens: OAuthTokens = {
      provider,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? '',
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await saveTokens(tokens);
    return ok(tokens);
  } catch (e) {
    return err({ kind: 'repo/write-failed', cause: `Token exchange error: ${String(e)}` });
  }
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  provider: CalendarProvider,
  config: OAuthConfig,
): Promise<Result<OAuthTokens, AppError>> {
  const existing = await loadTokens(provider);
  if (!existing || !existing.refreshToken) {
    return err({ kind: 'repo/write-failed', cause: 'No refresh token available' });
  }

  let tokenUrl: string;
  let body: URLSearchParams;

  if (provider === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    body = new URLSearchParams({
      refresh_token: existing.refreshToken,
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
      grant_type: 'refresh_token',
    });
  } else {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    body = new URLSearchParams({
      refresh_token: existing.refreshToken,
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
      grant_type: 'refresh_token',
      scope: 'Calendars.Read offline_access',
    });
  }

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      await clearTokens(provider);
      return err({ kind: 'repo/write-failed', cause: 'Refresh token expired — reconnect required' });
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const tokens: OAuthTokens = {
      provider,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? existing.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await saveTokens(tokens);
    return ok(tokens);
  } catch (e) {
    return err({ kind: 'repo/write-failed', cause: `Token refresh error: ${String(e)}` });
  }
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getValidToken(
  provider: CalendarProvider,
): Promise<Result<string, AppError>> {
  const tokens = await loadTokens(provider);
  if (!tokens) {
    return err({ kind: 'repo/write-failed', cause: '연결되지 않았습니다. Settings에서 캘린더를 연결하세요.' });
  }

  if (tokens.expiresAt > Date.now() + 60_000) {
    return ok(tokens.accessToken);
  }

  const config = loadOAuthConfig(provider);
  if (!config) {
    return err({ kind: 'repo/write-failed', cause: 'OAuth config not found' });
  }

  return refreshAccessToken(provider, config).then((r) =>
    r.ok ? ok(r.value.accessToken) : r,
  );
}
