import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createAiCredential } from '../domain/ai-credential';
import type { IAiCredentialRepository } from '../infrastructure/persistence/ai-credential-repository';
import { useOnlineStatus } from '../hooks/use-online-status';

function loadRecEnabled(): boolean {
  try {
    const raw = localStorage.getItem('planova-rec-enabled');
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

interface Toast {
  readonly text: string;
  readonly isError: boolean;
}

interface Props {
  readonly credentialRepository: IAiCredentialRepository;
}

const inputClass =
  'w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all font-mono text-sm';
const labelClass =
  'block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] mb-1.5';

/**
 * SettingsAiSection — UI for configuring the optional OpenRouter AI integration.
 *
 * The API key is stored PLAINTEXT in IndexedDB. A persistent warning banner
 * communicates this risk to the user.
 */
export const SettingsAiSection: React.FC<Props> = ({ credentialRepository }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [recEnabled, setRecEnabled] = useState(loadRecEnabled);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = useOnlineStatus();

  const handleToggleRec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setRecEnabled(value);
    try {
      localStorage.setItem('planova-rec-enabled', String(value));
    } catch {
      // storage full — toggle still applies until reload.
    }
  }, []);

  useEffect(() => {
    void credentialRepository.get().then((result) => {
      if (result.ok && result.value !== null) {
        setApiKey(result.value.apiKey);
        setModel(result.value.model);
      }
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [credentialRepository]);

  const showToast = (text: string, isError: boolean): void => {
    setToast({ text, isError });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (): Promise<void> => {
    const credResult = createAiCredential({ apiKey, model });
    if (!credResult.ok) {
      const msg =
        credResult.error.kind === 'validation/invalid-field'
          ? `${credResult.error.field}: ${credResult.error.reason}`
          : '유효하지 않은 입력입니다.';
      showToast(msg, true);
      return;
    }
    const saveResult = await credentialRepository.save(credResult.value);
    if (saveResult.ok) {
      showToast('AI 설정이 저장되었습니다.', false);
    } else {
      console.error(JSON.stringify({ level: 'error', op: 'settings.ai.save', error: saveResult.error }));
      showToast('저장에 실패했습니다. 다시 시도해 주세요.', true);
    }
  };

  const handleClear = async (): Promise<void> => {
    const result = await credentialRepository.clear();
    if (result.ok) {
      setApiKey('');
      setModel('');
      showToast('AI 설정이 삭제되었습니다.', false);
    } else {
      console.error(JSON.stringify({ level: 'error', op: 'settings.ai.clear', error: result.error }));
      showToast('삭제에 실패했습니다.', true);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">
          AI 어시스턴트 (선택)
        </h3>
        <span
          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight rounded-full ${
            isOnline
              ? 'bg-green-100 text-green-700'
              : 'bg-surface-container-highest text-on-surface-variant'
          }`}
        >
          {isOnline ? '온라인' : '오프라인'}
        </span>
      </div>

      {/* Plaintext storage warning */}
      <div className="mb-4 px-4 py-3 rounded-lg bg-slate-100 border border-yellow-400/60">
        <p className="text-xs font-medium text-yellow-700 leading-relaxed">
          ⚠ 이 키는 이 브라우저의 IndexedDB에 <strong>평문으로 저장</strong>됩니다.
          공용 기기에서는 사용하지 마세요.
          AI 기능을 쓰지 않으려면 키를 비워두세요.
        </p>
      </div>

      <div className="space-y-4">
        {/* API key field */}
        <div>
          <label className={labelClass}>OpenRouter API 키</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className={inputClass}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              {showKey ? '숨김' : '표시'}
            </button>
          </div>
        </div>

        {/* Model ID field */}
        <div>
          <label className={labelClass}>Model ID</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="예: mistralai/mistral-small-latest"
            className={inputClass}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => void handleSave()}
            className="px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-white text-sm font-bold rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all"
          >
            저장
          </button>
          <button
            onClick={() => void handleClear()}
            className="px-6 py-2.5 bg-surface-container-highest text-on-surface-variant text-sm font-bold rounded-lg hover:bg-surface-container active:scale-95 transition-all"
          >
            삭제
          </button>
        </div>

        {toast && (
          <p
            className={`text-sm font-medium ${
              toast.isError ? 'text-tertiary' : 'text-green-600'
            }`}
          >
            {toast.text}
          </p>
        )}
      </div>

      {/* Recommendation toggle */}
      <div className="mt-6 pt-4 border-t border-outline-variant/20">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={recEnabled}
            onChange={handleToggleRec}
            className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
          />
          <div>
            <span className="text-sm font-semibold text-on-surface">작업 추천 사용</span>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              완료 히스토리에서 주기성을 감지하고 새 작업을 추천합니다 (일 최대 2회 LLM 호출).
            </p>
          </div>
        </label>
      </div>
    </section>
  );
};
