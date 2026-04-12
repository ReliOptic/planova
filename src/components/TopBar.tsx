import React, { useState, useEffect, useRef } from 'react';
import { useOnlineStatus } from '../hooks/use-online-status.ts';
import { useSaveStatus, formatLastSaved } from '../hooks/use-save-status';
import { QuickAddInput } from './QuickAddInput';
import { parseTaskInput } from '../services/parse-task-input';
import { createTask } from '../domain/task';
import { taskRepository, logger } from '../app/dependencies';
import { getLocalToday } from '../utils/date-utils';

export interface TopBarHandle {
  focusQuickAdd: () => void;
}

interface TopBarProps {
  onOpenModal: () => void;
  quickAddRef?: React.RefObject<HTMLInputElement | null>;
}

/** TopBar — fixed header with quick-add input and status indicators. */
export const TopBar: React.FC<TopBarProps> = ({ onOpenModal, quickAddRef }) => {
  const isOnline = useOnlineStatus();
  const { lastSaved } = useSaveStatus();
  const [display, setDisplay] = useState('');
  const internalRef = useRef<HTMLInputElement>(null);
  const activeRef = quickAddRef ?? internalRef;

  // Update display every 10s to keep relative time fresh
  useEffect(() => {
    setDisplay(formatLastSaved(lastSaved));
    if (lastSaved === null) return;
    const interval = setInterval(() => setDisplay(formatLastSaved(lastSaved)), 10_000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  const handleQuickAddSubmit = async (input: string): Promise<void> => {
    const parsed = parseTaskInput(input);
    const taskId = crypto.randomUUID();
    const taskValidation = createTask({
      id: taskId,
      title: parsed.title,
      durationMinutes: parsed.durationMinutes,
      due: getLocalToday(),
      priority: parsed.priority,
      status: 'Pending',
      createdAt: Date.now(),
    });

    if (!taskValidation.ok) {
      logger.error('topbar/quick-add-validate', String(taskValidation.error));
      return;
    }

    const result = await taskRepository.create(taskValidation.value);
    if (!result.ok) {
      logger.error('topbar/quick-add-save', String(result.error));
    }
  };

  return (
    <header role="banner" className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl flex items-center px-8 h-16 pl-72 gap-4">
      <QuickAddInput
        onSubmit={handleQuickAddSubmit}
        onOpenModal={onOpenModal}
        inputRef={activeRef}
      />
      <div className="flex items-center gap-3 ml-auto shrink-0">
        {display && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
            <span>{display}</span>
          </div>
        )}
        {!isOnline && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            <span>오프라인</span>
          </div>
        )}
      </div>
    </header>
  );
};
