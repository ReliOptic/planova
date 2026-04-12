import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseTaskInput } from '../services/parse-task-input';
import { cn } from '../lib/utils';

interface QuickAddInputProps {
  /** Called when the user submits a task. Receives the raw input string. */
  onSubmit: (input: string) => Promise<void>;
  /** Called when the user wants to open the full modal (더보기 button). */
  onOpenModal: () => void;
  /** Ref forwarded so App.tsx can focus the input on 'N' key. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const PRIORITY_LABELS: Record<string, string> = {
  High: '높음',
  Medium: '보통',
  Low: '낮음',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: 'text-red-500',
  Medium: 'text-blue-500',
  Low: 'text-green-500',
};

function formatDurationPreview(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export const QuickAddInput: React.FC<QuickAddInputProps> = ({
  onSubmit,
  onOpenModal,
  inputRef,
}) => {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);
  const activeRef = inputRef ?? internalRef;

  const parsed = value.trim() ? parseTaskInput(value) : null;
  const showPreview = parsed !== null && value.trim().length > 0;

  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } finally {
      setIsSubmitting(false);
    }
  }, [value, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      } else if (e.key === 'Escape') {
        setValue('');
        activeRef.current?.blur();
      }
    },
    [handleSubmit, activeRef],
  );

  // Expose focus method via ref
  useEffect(() => {
    // nothing — ref is passed through
  }, []);

  return (
    <div className="flex flex-col gap-1 w-full max-w-md">
      {/* Input row */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
          'bg-white/90 backdrop-blur-sm',
          'border-outline-variant/30 focus-within:border-primary/50 focus-within:shadow-sm focus-within:shadow-primary/10',
        )}
      >
        <Plus
          size={15}
          className={cn(
            'shrink-0 transition-colors',
            value.trim() ? 'text-primary' : 'text-on-surface-variant/40',
          )}
        />
        <input
          ref={activeRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="작업 추가... (예: 회의 30m)"
          aria-label="빠른 작업 추가"
          className={cn(
            'flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/40',
            'outline-none min-w-0',
          )}
          disabled={isSubmitting}
        />

        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="shrink-0 text-green-500"
            >
              <Check size={15} />
            </motion.span>
          ) : (
            <motion.button
              key="expand"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={onOpenModal}
              title="더보기 (전체 폼 열기)"
              aria-label="전체 작업 폼 열기"
              className="shrink-0 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
            >
              <ChevronRight size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Parse preview */}
      <AnimatePresence>
        {showPreview && parsed && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-on-surface-variant/70 bg-surface-container/60 rounded-lg">
              <span className="font-medium text-on-surface truncate max-w-[120px]">{parsed.title}</span>
              <span className="text-outline-variant/60">|</span>
              <span>{formatDurationPreview(parsed.durationMinutes)}</span>
              <span className="text-outline-variant/60">|</span>
              <span className={cn('font-medium', PRIORITY_COLORS[parsed.priority])}>
                {PRIORITY_LABELS[parsed.priority]}
              </span>
              <span className="ml-auto text-[10px] text-outline-variant/50">Enter ↵</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
