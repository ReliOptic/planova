import React, { useState } from 'react';
import type { Logger } from '../infrastructure/logger/logger';

/** Props for SettingsDiagnosticsSection. */
export interface SettingsDiagnosticsSectionProps {
  /** Logger instance used to fetch and clear log entries. */
  readonly logger: Logger;
}

/**
 * SettingsDiagnosticsSection — settings panel for diagnostic log management.
 *
 * Provides two actions:
 *  - "최근 로그 내보내기": fetches the last 500 log entries and downloads as JSON.
 *  - "로그 지우기": clears all stored log entries.
 */
export const SettingsDiagnosticsSection: React.FC<SettingsDiagnosticsSectionProps> = ({
  logger,
}) => {
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = (): void => {
    logger
      .listRecent(500)
      .then((entries) => {
        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planova-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus(`${entries.length}개 항목 내보내기 완료`);
        setTimeout(() => setStatus(null), 3000);
      })
      .catch((cause: unknown) => {
        setStatus('내보내기 실패');
        console.error(
          JSON.stringify({ level: 'error', scope: 'settings/diagnostics', message: 'export-failed', cause: String(cause) }),
        );
      });
  };

  const handleClear = (): void => {
    logger
      .clear()
      .then(() => {
        setStatus('로그가 지워졌습니다');
        setTimeout(() => setStatus(null), 3000);
      })
      .catch((cause: unknown) => {
        setStatus('지우기 실패');
        console.error(
          JSON.stringify({ level: 'error', scope: 'settings/diagnostics', message: 'clear-failed', cause: String(cause) }),
        );
      });
  };

  const buttonClass =
    'px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-95';

  return (
    <section>
      <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">
        진단 로그
      </h3>
      <p className="text-xs text-on-surface-variant mb-4">
        앱 내부 이벤트 로그를 내보내거나 지웁니다.
      </p>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleExport}
          className={`${buttonClass} bg-surface-container-highest text-on-surface hover:brightness-110`}
        >
          최근 로그 내보내기
        </button>
        <button
          onClick={handleClear}
          className={`${buttonClass} bg-surface-container-highest text-tertiary hover:brightness-110`}
        >
          로그 지우기
        </button>
      </div>
      {status && (
        <p className="mt-2 text-xs text-on-surface-variant">{status}</p>
      )}
    </section>
  );
};
