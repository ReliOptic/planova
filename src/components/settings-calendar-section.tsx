import React, { useCallback, useEffect, useState } from 'react';
import {
  type CalendarProvider,
  isConnected,
  clearTokens,
  loadOAuthConfig,
  saveOAuthConfig,
  startOAuthFlow,
  type OAuthConfig,
} from '../infrastructure/calendar/oauth';
import { isTauriEnvironment } from '../infrastructure/tauri/backup-io';

interface Props {
  readonly onMessage: (text: string, isError: boolean) => void;
}

const labelClass = 'block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] mb-1.5';
const inputClass = 'w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all font-mono text-sm';
const btnClass = 'px-5 py-2.5 text-sm font-bold rounded-lg transition-all active:scale-95';

const ProviderCard: React.FC<{
  provider: CalendarProvider;
  label: string;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  config: OAuthConfig | null;
  onConfigChange: (config: OAuthConfig) => void;
}> = ({ provider, label, connected, onConnect, onDisconnect, config, onConfigChange }) => {
  const [clientId, setClientId] = useState(config?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState(config?.clientSecret ?? '');

  const handleSaveConfig = () => {
    if (!clientId.trim()) return;
    onConfigChange({ clientId: clientId.trim(), clientSecret: clientSecret.trim() || undefined });
  };

  return (
    <div className="border border-outline-variant/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-on-surface">{label}</span>
          {connected ? (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-green-100 text-green-700 rounded-full">연결됨</span>
          ) : (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-surface-container-highest text-on-surface-variant rounded-full">미연결</span>
          )}
        </div>
      </div>

      {!connected ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={provider === 'google' ? 'Google Cloud Console에서 발급' : 'Azure Portal에서 발급'}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Client Secret (선택)</label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="공개 클라이언트는 비워두세요"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveConfig}
              disabled={!clientId.trim()}
              className={`${btnClass} bg-surface-container border border-outline-variant/30 text-on-surface hover:bg-surface-container-high disabled:opacity-50`}
            >
              저장
            </button>
            <button
              onClick={onConnect}
              disabled={!config?.clientId}
              className={`${btnClass} bg-gradient-to-br from-primary to-primary-container text-white shadow-sm hover:brightness-110 disabled:opacity-50`}
            >
              연결하기
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onDisconnect}
          className={`${btnClass} bg-surface-container border border-outline-variant/30 text-tertiary hover:bg-surface-container-high`}
        >
          연결 해제
        </button>
      )}
    </div>
  );
};

export const SettingsCalendarSection: React.FC<Props> = ({ onMessage }) => {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [msConnected, setMsConnected] = useState(false);
  const [googleConfig, setGoogleConfig] = useState<OAuthConfig | null>(null);
  const [msConfig, setMsConfig] = useState<OAuthConfig | null>(null);

  useEffect(() => {
    void isConnected('google').then(setGoogleConnected);
    void isConnected('microsoft').then(setMsConnected);
    setGoogleConfig(loadOAuthConfig('google'));
    setMsConfig(loadOAuthConfig('microsoft'));
  }, []);

  const handleConnect = useCallback(async (provider: CalendarProvider) => {
    const config = loadOAuthConfig(provider);
    if (!config) {
      onMessage('먼저 Client ID를 저장하세요.', true);
      return;
    }
    const result = await startOAuthFlow(provider, config);
    if (!result.ok) {
      const cause = 'cause' in result.error ? result.error.cause : result.error.kind;
      onMessage(`연결 실패: ${cause}`, true);
      return;
    }
    onMessage('브라우저에서 로그인하세요. 완료되면 자동으로 연결됩니다.', false);
  }, [onMessage]);

  const handleDisconnect = useCallback(async (provider: CalendarProvider) => {
    await clearTokens(provider);
    if (provider === 'google') setGoogleConnected(false);
    else setMsConnected(false);
    onMessage('캘린더 연결이 해제되었습니다.', false);
  }, [onMessage]);

  const handleConfigChange = useCallback((provider: CalendarProvider, config: OAuthConfig) => {
    saveOAuthConfig(provider, config);
    if (provider === 'google') setGoogleConfig(config);
    else setMsConfig(config);
    onMessage('설정이 저장되었습니다.', false);
  }, [onMessage]);

  if (!isTauriEnvironment()) {
    return (
      <section className="mb-8">
        <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">캘린더 연동</h3>
        <p className="text-xs text-on-surface-variant">Tauri 데스크톱 앱에서만 사용 가능합니다.</p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold text-on-surface mb-2 uppercase tracking-wide">캘린더 연동</h3>
      <p className="text-xs text-on-surface-variant mb-4">
        Google Calendar 또는 Microsoft Outlook에서 일정을 가져옵니다. 읽기 전용으로 타임라인에 표시됩니다.
      </p>

      <div className="space-y-3">
        <ProviderCard
          provider="google"
          label="Google Calendar"
          connected={googleConnected}
          onConnect={() => void handleConnect('google')}
          onDisconnect={() => void handleDisconnect('google')}
          config={googleConfig}
          onConfigChange={(c) => handleConfigChange('google', c)}
        />
        <ProviderCard
          provider="microsoft"
          label="Microsoft Outlook"
          connected={msConnected}
          onConnect={() => void handleConnect('microsoft')}
          onDisconnect={() => void handleDisconnect('microsoft')}
          config={msConfig}
          onConfigChange={(c) => handleConfigChange('microsoft', c)}
        />
      </div>
    </section>
  );
};
