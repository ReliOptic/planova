import type { DragEndEvent } from '@dnd-kit/core';
import type { TaskViewModel } from '../services/task-view-model';
import {
  handleCompleteTask,
  handleStartTask,
  handleDeleteTask,
  handleSaveTask,
} from './use-task-crud';
import { handleDragEnd, handleResizeTask } from './use-task-schedule';

/** Public surface returned by useTaskActions. */
export interface UseTaskActionsReturn {
  readonly handleDragEnd: (event: DragEndEvent) => Promise<void>;
  readonly handleCompleteTask: (taskId: string) => Promise<void>;
  readonly handleStartTask: (taskId: string) => Promise<void>;
  readonly handleDeleteTask: (taskId: string) => Promise<void>;
  readonly handleResizeTask: (
    taskId: string,
    edge: 'top' | 'bottom',
    deltaSlots: number,
  ) => Promise<void>;
  readonly handleSaveTask: (taskData: Partial<TaskViewModel>) => Promise<void>;
}

/**
 * useTaskActions — composes CRUD and scheduling handlers into a single surface.
 *
 * @param tasks           - Current list of TaskViewModels from liveQuery.
 * @param showToast       - Callback to surface user-facing messages.
 * @param setIsModalOpen  - Controls task modal open state.
 * @param setEditingTask  - Sets the task being edited.
 */
export function useTaskActions(
  tasks: readonly TaskViewModel[],
  showToast: (msg: string, type?: 'error' | 'success') => void,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: TaskViewModel | null) => void,
): UseTaskActionsReturn {
  return {
    handleDragEnd: (event) => handleDragEnd(event, tasks, showToast),
    handleCompleteTask: (taskId) => handleCompleteTask(taskId, showToast),
    handleStartTask: (taskId) => handleStartTask(taskId, showToast),
    handleDeleteTask: (taskId) => handleDeleteTask(taskId, showToast),
    handleResizeTask: (taskId, edge, deltaSlots) =>
      handleResizeTask(taskId, edge, deltaSlots, tasks, showToast),
    handleSaveTask: (taskData) =>
      handleSaveTask(taskData, tasks, showToast, setIsModalOpen, setEditingTask),
  };
}
