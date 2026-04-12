import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { liveQuery } from 'dexie';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TaskCard } from './components/TaskCard';
import { Timeline } from './components/Timeline';
import { TaskModal } from './components/TaskModal';
const HistoryView = lazy(() =>
  import('./components/HistoryView').then((m) => ({ default: m.HistoryView })),
);
const SettingsPage = lazy(() =>
  import('./components/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import type { Task } from './types';
import { cn } from './lib/utils';
import { db } from './infrastructure/persistence/db';
import { runMigrations } from './infrastructure/persistence/migrations/runner';
import { composeViewModels } from './services/task-view-model';
import type { TaskViewModel } from './services/task-view-model';
import type { Task as DomainTask } from './domain/task';
import type { ScheduleBlock } from './domain/schedule-block';
import { useTaskActions } from './hooks/useTaskActions';
import { migrateCredentialToStronghold } from './infrastructure/tauri/stronghold-credential-repository';
import { dexieAiCredentialRepository, aiCredentialRepository } from './app/dependencies';
import { useOverdueNotifications } from './hooks/use-overdue-notifications';

const PendingDroppable: React.FC<{
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}> = ({ tasks, onEditTask, onDeleteTask }) => {
  const { isOver, setNodeRef } = useDroppable({ id: 'pending-column' });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'w-80 flex flex-col gap-6 p-4 rounded-2xl transition-colors',
        isOver ? 'bg-primary/5 ring-2 ring-dashed ring-primary/20' : 'bg-transparent',
      )}
    >
      <div className="flex justify-between items-end">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Backlog</span>
          <h2 className="text-2xl font-bold font-headline text-on-surface mt-1">Pending</h2>
        </div>
        <span className="text-xs font-medium px-2 py-1 bg-surface-container-highest text-on-surface-variant rounded">
          {tasks.length} Tasks
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar min-h-[200px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant/40 border-2 border-dashed border-outline-variant/20 rounded-xl p-8 text-center">
            <p className="text-sm font-medium">No pending tasks</p>
            <p className="text-[10px]">Drag tasks here to unschedule</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<readonly TaskViewModel[]>([]);
  const [isMigrating, setIsMigrating] = useState(true);
  const { toast, showToast, dismissToast } = useToast();
  useOverdueNotifications();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Run migrations once on mount, then subscribe to live data.
  useEffect(() => {
    let taskUnsub: (() => void) | undefined;
    let blockUnsub: (() => void) | undefined;
    let domainTasks: readonly DomainTask[] = [];
    let domainBlocks: readonly ScheduleBlock[] = [];

    const recompose = (): void => {
      setTasks(composeViewModels(domainTasks, domainBlocks));
    };

    const init = async (): Promise<void> => {
      const result = await runMigrations(db);
      if (!result.ok) {
        const { error } = result;
        console.error(
          JSON.stringify({ level: 'error', event: 'app/migration-failed', cause: error }),
        );
        showToast('Database migration failed. Some data may be unavailable.');
      }
      setIsMigrating(false);

      // Migrate plaintext API key to Stronghold (one-time, Tauri only)
      void migrateCredentialToStronghold(dexieAiCredentialRepository, aiCredentialRepository);

      const taskSub = liveQuery(() =>
        db.tasks.orderBy('createdAt').reverse().toArray(),
      ).subscribe({
        next: (t) => {
          domainTasks = t;
          recompose();
        },
        error: (cause: unknown) => {
          console.error(JSON.stringify({ level: 'error', event: 'app/tasks-watch', cause: String(cause) }));
        },
      });

      const blockSub = liveQuery(() => db.scheduleBlocks.toArray()).subscribe({
        next: (b) => {
          domainBlocks = b;
          recompose();
        },
        error: (cause: unknown) => {
          console.error(JSON.stringify({ level: 'error', event: 'app/blocks-watch', cause: String(cause) }));
        },
      });

      taskUnsub = () => taskSub.unsubscribe();
      blockUnsub = () => blockSub.unsubscribe();
    };

    init().catch((cause: unknown) => {
      console.error(JSON.stringify({ level: 'error', event: 'app/init-failed', cause: String(cause) }));
      setIsMigrating(false);
    });

    return () => {
      taskUnsub?.();
      blockUnsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
        setEditingTask(null);
        return;
      }
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'n' && !isModalOpen) {
        e.preventDefault();
        setIsModalOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const { handleDragEnd, handleCompleteTask, handleStartTask, handleDeleteTask, handleResizeTask, handleSaveTask, handleQuickAdd } =
    useTaskActions(tasks, showToast, setIsModalOpen, setEditingTask);

  const handleEditTask = (task: Task): void => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const pendingTasks = tasks.filter((t) => t.status === 'Pending');
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;

  if (isMigrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-surface">
        {/* Skip navigation link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-bold"
        >
          메인 콘텐츠로 이동
        </a>

        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddTask={() => void handleQuickAdd()}
          pendingCount={pendingTasks.length}
          completedCount={completedCount}
        />
        <TopBar />

        <main id="main-content" role="main" aria-label="Dashboard content" className="pl-64 pt-16 min-h-screen">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8 flex gap-8 h-[calc(100vh-4rem)]"
              >
                {tasks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-center max-w-sm">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                        <Plus className="text-primary" size={28} />
                      </div>
                      <h2 className="text-xl font-bold font-headline text-on-surface mb-2">Plan your day</h2>
                      <p className="text-sm text-on-surface-variant mb-8">
                        Create your first task and drag it onto the timeline to get started.
                      </p>
                      <button
                        onClick={() => void handleQuickAdd()}
                        className="px-8 py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all"
                      >
                        Create First Task
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <PendingDroppable
                      tasks={pendingTasks as Task[]}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                    />
                    <Timeline
                      tasks={tasks as unknown as Task[]}
                      onCompleteTask={handleCompleteTask}
                      onStartTask={handleStartTask}
                      onEditTask={handleEditTask}
                      onResizeTask={handleResizeTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  </>
                )}
              </motion.div>
            ) : activeTab === 'history' ? (
              <Suspense fallback={<div className="p-8 text-sm text-slate-400">로딩 중...</div>}>
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <HistoryView />
                </motion.div>
              </Suspense>
            ) : activeTab === 'settings' ? (
              <Suspense fallback={<div className="p-8 text-sm text-slate-400">로딩 중...</div>}>
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <SettingsPage />
                </motion.div>
              </Suspense>
            ) : null}
          </AnimatePresence>
        </main>

        <TaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          editingTask={editingTask}
        />
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
      </div>
    </DndContext>
  );
}
