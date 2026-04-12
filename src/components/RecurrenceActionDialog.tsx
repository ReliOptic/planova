import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Repeat } from 'lucide-react';

export type RecurrenceAction = 'delete' | 'edit';
export type RecurrenceChoice = 'this' | 'future' | 'all';

interface RecurrenceActionDialogProps {
  readonly isOpen: boolean;
  readonly action: RecurrenceAction;
  readonly onChoice: (choice: RecurrenceChoice) => void;
  readonly onCancel: () => void;
}

const DELETE_OPTIONS: { choice: RecurrenceChoice; label: string; desc: string }[] = [
  { choice: 'this', label: '이 작업만', desc: '선택한 작업만 삭제합니다.' },
  { choice: 'future', label: '이후 모든 작업', desc: '이 작업과 이후 반복 작업을 모두 삭제합니다.' },
  { choice: 'all', label: '전체 시리즈', desc: '이 반복 일정의 모든 작업을 삭제합니다.' },
];

const EDIT_OPTIONS: { choice: RecurrenceChoice; label: string; desc: string }[] = [
  { choice: 'this', label: '이 작업만', desc: '선택한 작업만 수정합니다. 시리즈에서 분리됩니다.' },
  { choice: 'future', label: '이후 모든 작업', desc: '이 작업과 이후 반복 작업에 변경을 적용합니다.' },
];

export const RecurrenceActionDialog: React.FC<RecurrenceActionDialogProps> = ({
  isOpen,
  action,
  onChoice,
  onCancel,
}) => {
  const firstBtnRef = useRef<HTMLButtonElement>(null);
  const options = action === 'delete' ? DELETE_OPTIONS : EDIT_OPTIONS;
  const title = action === 'delete' ? '반복 작업 삭제' : '반복 작업 수정';

  useEffect(() => {
    if (isOpen) firstBtnRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-on-surface/10 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="recurrence-dialog-title"
            className="w-full max-w-sm bg-white/90 backdrop-blur-2xl rounded-xl overflow-hidden shadow-2xl relative z-10"
          >
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Repeat size={18} className="text-primary" />
                <h2 id="recurrence-dialog-title" className="text-lg font-headline font-bold text-on-surface">
                  {title}
                </h2>
              </div>
              <p className="text-sm text-on-surface-variant">
                이 작업은 반복 일정입니다. 어떻게 처리할까요?
              </p>
            </div>

            <div className="px-6 pb-4 space-y-2">
              {options.map((opt, idx) => (
                <button
                  key={opt.choice}
                  ref={idx === 0 ? firstBtnRef : undefined}
                  onClick={() => onChoice(opt.choice)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-outline-variant/20 hover:bg-primary/5 hover:border-primary/30 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <span className="text-sm font-semibold text-on-surface">{opt.label}</span>
                  <p className="text-xs text-on-surface-variant mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={onCancel}
                className="w-full py-2.5 text-sm font-medium text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                취소
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
