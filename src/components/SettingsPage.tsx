import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getWorkHours, saveWorkHours } from '@/src/utils/settings';
import { SettingsBackupSection } from './settings-backup-section';
import { SettingsAiSection } from './settings-ai-section';
import { SettingsDiagnosticsSection } from './settings-diagnostics-section';
import { aiCredentialRepository, logger, taskRepository, scheduleBlockRepository } from '../app/dependencies';
import { generateICS } from '../utils/ics-export';
import { composeViewModels } from '../services/task-view-model';
import type { ScheduleBlock } from '../domain/schedule-block';
import { isTauriEnvironment } from '../infrastructure/tauri/backup-io';
import { SettingsCalendarSection } from './settings-calendar-section';

const SettingsUpdateSection: React.FC<{ onMessage: (text: string, isError: boolean) => void }> = ({ onMessage }) => {
  const [checking, setChecking] = useState(false);

  const handleCheckUpdate = useCallback(async () => {
    setChecking(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        onMessage(`새 버전 ${update.version} 발견. 다운로드 중...`, false);
        await update.downloadAndInstall();
        onMessage('업데이트 설치 완료. 앱을 재시작합니다.', false);
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } else {
        onMessage('최신 버전입니다.', false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onMessage(`업데이트 확인 실패: ${msg}`, true);
    } finally {
      setChecking(false);
    }
  }, [onMessage]);

  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">앱 업데이트</h3>
      <p className="text-xs text-on-surface-variant mb-4">현재 버전: v0.1.0</p>
      <button
        onClick={() => void handleCheckUpdate()}
        disabled={checking}
        className="px-6 py-2.5 bg-surface-container border border-outline-variant/30 text-on-surface text-sm font-bold rounded-lg hover:bg-surface-container-high active:scale-95 transition-all disabled:opacity-50"
      >
        {checking ? '확인 중...' : '업데이트 확인'}
      </button>
    </section>
  );
};

const hourOptions = Array.from({ length: 18 }, (_, i) => {
  const h = i + 5; // 5am to 10pm
  const d = new Date(2000, 0, 1, h);
  return {
    value: h,
    label: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
  };
});

export const SettingsPage: React.FC = () => {
  const initial = getWorkHours();
  const [startHour, setStartHour] = useState(initial.start);
  const [endHour, setEndHour] = useState(initial.end);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleSave = () => {
    const result = saveWorkHours({ start: startHour, end: endHour });
    if (result.success) {
      setMessage({ text: 'Settings saved.', isError: false });
    } else {
      setMessage({ text: result.error || 'Could not save settings', isError: true });
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const handleBackupMessage = (text: string, isError: boolean) => {
    setMessage({ text, isError });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 4000);
  };

  const inputClass =
    'w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface appearance-none focus:ring-2 focus:ring-primary outline-none transition-all';
  const labelClass =
    'block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] mb-1.5';

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold font-headline text-on-surface mb-1">Settings</h2>
      <p className="text-sm text-on-surface-variant mb-8">Configure your workspace preferences.</p>

      {/* Work Hours */}
      <section className="mb-8">
        <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">Work Hours</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>Start Time</label>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className={inputClass}
            >
              {hourOptions.filter((o) => o.value < endHour).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>End Time</label>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className={inputClass}
            >
              {hourOptions.filter((o) => o.value > startHour).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="mt-4 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-white text-sm font-bold rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all"
        >
          Save Work Hours
        </button>
        {message && (
          <p className={`mt-2 text-sm font-medium ${message.isError ? 'text-tertiary' : 'text-green-600'}`}>
            {message.text}
          </p>
        )}
      </section>

      <hr className="border-surface-container-highest mb-8" />

      {/* AI Assistant */}
      <SettingsAiSection credentialRepository={aiCredentialRepository} />

      <hr className="border-surface-container-highest mb-8" />

      {/* Backup / Restore */}
      <SettingsBackupSection onMessage={handleBackupMessage} />

      <hr className="border-surface-container-highest mb-8" />

      {/* Calendar Export */}
      <section className="mb-8">
        <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">캘린더 내보내기</h3>
        <p className="text-xs text-on-surface-variant mb-4">스케줄된 작업을 .ics 파일로 내보내서 Google Calendar에 가져올 수 있습니다.</p>
        <button
          onClick={async () => {
            try {
              const tasksResult = await taskRepository.list();
              if (!tasksResult.ok) { handleBackupMessage('작업 목록 조회 실패', true); return; }
              const blocksResult = await scheduleBlockRepository.listForRange('2000-01-01', '2099-12-31');
              if (!blocksResult.ok) { handleBackupMessage('일정 조회 실패', true); return; }
              const viewModels = composeViewModels(tasksResult.value, blocksResult.value as unknown as readonly ScheduleBlock[]);
              const ics = generateICS(viewModels);
              if (!ics) { handleBackupMessage('내보낼 스케줄된 작업이 없습니다.', true); return; }

              if (isTauriEnvironment()) {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeTextFile } = await import('@tauri-apps/plugin-fs');
                const path = await save({ defaultPath: 'planova-schedule.ics', filters: [{ name: 'iCalendar', extensions: ['ics'] }] });
                if (path) {
                  await writeTextFile(path, ics);
                  handleBackupMessage('캘린더 파일이 저장되었습니다.', false);
                }
              } else {
                const blob = new Blob([ics], { type: 'text/calendar' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'planova-schedule.ics'; a.click();
                URL.revokeObjectURL(url);
                handleBackupMessage('캘린더 파일이 다운로드되었습니다.', false);
              }
            } catch {
              handleBackupMessage('내보내기 실패', true);
            }
          }}
          className="px-6 py-2.5 bg-surface-container border border-outline-variant/30 text-on-surface text-sm font-bold rounded-lg hover:bg-surface-container-high active:scale-95 transition-all"
        >
          .ics 파일 내보내기
        </button>
      </section>

      <hr className="border-surface-container-highest mb-8" />

      {/* Calendar OAuth */}
      <SettingsCalendarSection onMessage={handleBackupMessage} />

      <hr className="border-surface-container-highest mb-8 mt-8" />

      {/* App Update */}
      {isTauriEnvironment() && <SettingsUpdateSection onMessage={handleBackupMessage} />}

      {isTauriEnvironment() && <hr className="border-surface-container-highest mb-8" />}

      {/* Data Reset */}
      <section className="mb-8">
        <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">데이터 관리</h3>
        <p className="text-xs text-on-surface-variant mb-4">모든 작업과 일정을 삭제하고 초기 상태로 되돌립니다.</p>
        <button
          onClick={async () => {
            if (!window.confirm('정말 모든 작업과 일정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
            if (!window.confirm('한 번 더 확인합니다. 모든 데이터가 영구 삭제됩니다.')) return;
            try {
              const tasksResult = await taskRepository.list();
              if (tasksResult.ok) {
                for (const t of tasksResult.value) {
                  await taskRepository.delete(t.id);
                }
              }
              const today = new Date().toISOString().slice(0, 10);
              const blocksResult = await scheduleBlockRepository.listForRange('2000-01-01', '2099-12-31');
              if (blocksResult.ok) {
                for (const b of blocksResult.value) {
                  await scheduleBlockRepository.delete(b.id);
                }
              }
              handleBackupMessage('모든 데이터가 초기화되었습니다.', false);
            } catch {
              handleBackupMessage('초기화 실패', true);
            }
          }}
          className="px-6 py-2.5 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 active:scale-95 transition-all"
        >
          모든 작업 초기화
        </button>
      </section>

      <hr className="border-surface-container-highest mb-8" />

      {/* Diagnostics */}
      <SettingsDiagnosticsSection logger={logger} />
    </div>
  );
};
