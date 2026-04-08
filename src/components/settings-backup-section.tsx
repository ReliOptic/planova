import React, { useRef, useState } from 'react';
import { BackupService } from '@/src/services/backup-service';
import { db } from '@/src/infrastructure/persistence/db';
import { isBackupBundle, type BackupBundle } from '@/src/domain/backup-bundle';
import { downloadJson } from '@/src/utils/file-io';
import { readJsonFile } from '@/src/utils/file-io';
import type { ImportSummary } from '@/src/services/backup-service';

const backupService = new BackupService(db);

interface ConfirmState {
  readonly bundle: BackupBundle;
  readonly taskCount: number;
  readonly blockCount: number;
}

interface Props {
  readonly onMessage: (text: string, isError: boolean) => void;
}

/**
 * SettingsBackupSection — "백업 / 복원" section for SettingsPage.
 * Handles export to JSON and import via file picker with replace/merge modes.
 */
export const SettingsBackupSection: React.FC<Props> = ({ onMessage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    const result = await backupService.export();
    if (!result.ok) {
      const detail = 'cause' in result.error ? result.error.cause : result.error.kind;
      onMessage(`내보내기 실패: ${detail}`, true);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`planova-backup-${date}.json`, result.value);
    onMessage('백업 파일이 다운로드되었습니다.', false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be picked again
    e.target.value = '';

    const readResult = await readJsonFile(file);
    if (!readResult.ok) {
      onMessage(`파일 읽기 실패: ${readResult.error.kind}`, true);
      return;
    }

    if (!isBackupBundle(readResult.value)) {
      onMessage('유효하지 않은 백업 파일입니다.', true);
      return;
    }

    const bundle = readResult.value;
    setConfirm({
      bundle,
      taskCount: bundle.tasks.length,
      blockCount: bundle.scheduleBlocks.length,
    });
  };

  const handleImport = async (mode: 'replace' | 'merge') => {
    if (!confirm) return;
    setImporting(true);
    const result = await backupService.import(confirm.bundle, mode);
    setImporting(false);
    setConfirm(null);

    if (!result.ok) {
      const detail = 'cause' in result.error ? result.error.cause : result.error.kind;
      onMessage(`가져오기 실패: ${detail}`, true);
      return;
    }

    const s: ImportSummary = result.value;
    onMessage(
      `가져오기 완료 — 작업 ${s.tasksImported}개, 일정 ${s.scheduleBlocksImported}개 (충돌 건너뜀 ${s.conflictsSkipped}개)`,
      false,
    );
  };

  const btnClass =
    'px-5 py-2.5 text-sm font-bold rounded-lg transition-all active:scale-95';

  return (
    <>
      <section className="mb-8">
        <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">백업 / 복원</h3>
        <p className="text-xs text-on-surface-variant mb-4">
          모든 작업과 일정을 JSON 파일로 내보내거나 복원합니다.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleExport}
            className={`${btnClass} bg-gradient-to-br from-primary to-primary-container text-white shadow-sm hover:brightness-110`}
          >
            내보내기
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`${btnClass} bg-surface-container border border-outline-variant/30 text-on-surface hover:bg-surface-container-high`}
          >
            가져오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>

      {confirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h4 className="text-base font-bold text-on-surface mb-2">가져오기 확인</h4>
            <p className="text-sm text-on-surface-variant mb-4">
              작업 <strong>{confirm.taskCount}개</strong>, 일정 블록{' '}
              <strong>{confirm.blockCount}개</strong>를 가져옵니다.
            </p>
            <p className="text-xs text-on-surface-variant mb-6">
              <strong>교체</strong>: 기존 데이터를 모두 지우고 백업으로 교체합니다.
              <br />
              <strong>병합</strong>: 중복 ID는 건너뛰고 새 항목만 추가합니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                disabled={importing}
                className={`${btnClass} bg-surface-container border border-outline-variant/30 text-on-surface`}
              >
                취소
              </button>
              <button
                onClick={() => handleImport('merge')}
                disabled={importing}
                className={`${btnClass} bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest`}
              >
                병합
              </button>
              <button
                onClick={() => handleImport('replace')}
                disabled={importing}
                className={`${btnClass} bg-tertiary text-white hover:brightness-110`}
              >
                교체
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
