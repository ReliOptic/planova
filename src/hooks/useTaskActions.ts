import type { DragEndEvent } from '@dnd-kit/core';
import type { TaskViewModel } from '../services/task-view-model';
import {
  handleCompleteTask,
  handleStartTask,
  handleDeleteTask,
  handleSaveTask,
  handleQuickAdd,
  type RecurrenceChoice,
} from './use-task-crud';
import { handleDragEnd, handleResizeTask } from './use-task-schedule';

/** Pending recurrence dialog state. */
export interface RecurrenceDialogState {
  readonly taskId: string;
  readonly action: 'delete' | 'edit';
  readonly pendingData?: Partial<TaskViewModel>;
}

/** Public surface returned by useTaskActions. */
export interface UseTaskActionsReturn {
  readonly handleDragEnd: (event: DragEndEvent) => Promise<void>;
  readonly handleCompleteTask: (taskId: string) => Promise<void>;
  readonly handleStartTask: (taskId: string) => Promise<void>;
  readonly handleDeleteTask: (taskId: string, recurrenceAction?: RecurrenceChoice) => Promise<void>;
  readonly handleResizeTask: (
    taskId: string,
    edge: 'top' | 'bottom',
    deltaSlots: number,
  ) => Promise<void>;
  readonly handleSaveTask: (taskData: Partial<TaskViewModel>, recurrenceAction?: RecurrenceChoice) => Promise<void>;
  readonly handleQuickAdd: () => Promise<void>;
}

/**
 * useTaskActions — composes CRUD and scheduling handlers into a single surface.
 *
 * @param tasks              - Current list of TaskViewModels from liveQuery.
 * @param showToast          - Callback to surface user-facing messages.
 * @param setIsModalOpen     - Controls task modal open state.
 * @param setEditingTask     - Sets the task being edited.
 * @param onRecurrenceChoice - Called when a recurring task needs user to pick this/future/all.
 */
export function useTaskActions(
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: TaskViewModel | null) => void,
  onRecurrenceChoice?: (state: RecurrenceDialogState) => void,
): UseTaskActionsReturn {
  return {
    handleDragEnd: (event) => handleDragEnd(event, tasks, showToast),
    handleCompleteTask: (taskId) => handleCompleteTask(taskId, showToast),
    handleStartTask: (taskId) => handleStartTask(taskId, showToast),
    handleDeleteTask: async (taskId, recurrenceAction?) => {
      const result = await handleDeleteTask(taskId, showToast, recurrenceAction);
      if (result === 'needs-recurrence-choice' && onRecurrenceChoice) {
        onRecurrenceChoice({ taskId, action: 'delete' });
      }
    },
    handleResizeTask: (taskId, edge, deltaSlots) =>
      handleResizeTask(taskId, edge, deltaSlots, tasks, showToast),
    handleSaveTask: async (taskData, recurrenceAction?) => {
      const result = await handleSaveTask(taskData, tasks, showToast, setIsModalOpen, setEditingTask, recurrenceAction);
      if (result === 'needs-recurrence-choice' && onRecurrenceChoice && taskData.id) {
        onRecurrenceChoice({ taskId: taskData.id, action: 'edit', pendingData: taskData });
      }
    },
    handleQuickAdd: () => handleQuickAdd(showToast).then(() => undefined),
  };
}
