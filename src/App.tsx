import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TaskCard } from './components/TaskCard';
import { Timeline } from './components/Timeline';
import { TaskModal } from './components/TaskModal';
import { HistoryView } from './components/HistoryView';
import { SettingsPage } from './components/SettingsPage';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { Task, SCHEMA_VERSION } from './types';
import { cn } from './lib/utils';
import { auth, db, handleFirestoreError, OperationType, loginWithGoogle } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { migrateTask } from './utils/migrate';
import { buildUTCTime, getLocalToday } from './utils/date-utils';
import { getWorkHours } from './utils/settings';

const PendingDroppable: React.FC<{ tasks: Task[]; onEditTask: (task: Task) => void; onDeleteTask: (taskId: string) => void }> = ({ tasks, onEditTask, onDeleteTask }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'pending-column',
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "w-80 flex flex-col gap-6 p-4 rounded-2xl transition-colors",
        isOver ? "bg-primary/5 ring-2 ring-dashed ring-primary/20" : "bg-transparent"
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
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onEdit={() => onEditTask(task)} onDelete={() => onDeleteTask(task.id)} />
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { toast, showToast, dismissToast } = useToast();

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setTasks([]);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        taskList.push(migrateTask(raw));
      });
      setTasks(taskList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !user) return;

    const taskId = active.id.toString();
    const taskRef = doc(db, 'tasks', taskId);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      if (over.id.toString().startsWith('slot-')) {
        // Guard: ensure drop data exists
        const hour = over.data.current?.hour;
        const minute = over.data.current?.minute;
        const selectedDate = over.data.current?.selectedDate;
        if (hour === undefined || minute === undefined || !selectedDate) return;

        const endMinutes = hour * 60 + minute + task.duration;
        const endHour = Math.floor(endMinutes / 60);
        const endMinute = endMinutes % 60;

        // Reject drops that overflow past work hours or midnight
        const workHours = getWorkHours();
        if (endHour >= workHours.end) {
          showToast('Task extends past work hours. Try an earlier slot.');
          return;
        }

        const startTime = buildUTCTime(selectedDate, hour, minute);
        const endTime = buildUTCTime(selectedDate, endHour, endMinute);

        await updateDoc(taskRef, {
          status: 'Scheduled',
          startTime,
          endTime,
          scheduledDate: selectedDate,
        });
        showToast('Task scheduled', 'success');
      }
      else if (over.id === 'pending-column') {
        await updateDoc(taskRef, {
          status: 'Pending',
          startTime: null,
          endTime: null,
          scheduledDate: null,
        });
        showToast('Task unscheduled', 'success');
      }
    } catch (error) {
      showToast('Failed to move task. Please try again.');
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: 'Completed',
        completedAt: Date.now(),
      });
      showToast('Task completed', 'success');
    } catch (error) {
      showToast('Failed to complete task. Please try again.');
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleStartTask = async (taskId: string) => {
    if (!user) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: 'In Progress',
      });
    } catch (error) {
      showToast('Failed to start task. Please try again.');
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    if (!user) return;
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      showToast('Task deleted', 'success');
    } catch (error) {
      showToast('Failed to delete task. Please try again.');
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const handleResizeTask = async (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.startTime || !task.endTime || !task.scheduledDate) return;

    const deltaMinutes = deltaSlots * 15;
    const taskRef = doc(db, 'tasks', taskId);

    try {
      if (edge === 'top') {
        // Move start time, keep end time fixed → changes duration
        const startDate = new Date(task.startTime);
        const newStartMs = startDate.getTime() + deltaMinutes * 60_000;
        const newStart = new Date(newStartMs);
        const newDuration = task.duration - deltaMinutes;
        if (newDuration < 15) return; // min 15 min
        const startHour = newStart.getUTCHours();
        const startMinute = newStart.getUTCMinutes();
        const startTime = buildUTCTime(task.scheduledDate, startHour, startMinute);
        await updateDoc(taskRef, { startTime, duration: newDuration });
      } else {
        // Move end time, keep start time fixed → changes duration
        const newDuration = task.duration + deltaMinutes;
        if (newDuration < 15) return;
        const startDate = new Date(task.startTime);
        const endMs = startDate.getTime() + newDuration * 60_000;
        const newEnd = new Date(endMs);
        const endHour = newEnd.getUTCHours();
        const endMinute = newEnd.getUTCMinutes();
        const endTime = buildUTCTime(task.scheduledDate, endHour, endMinute);
        await updateDoc(taskRef, { endTime, duration: newDuration });
      }
    } catch (error) {
      showToast('Failed to resize task. Please try again.');
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!user) return;

    // Update existing task
    if (taskData.id) {
      try {
        const taskRef = doc(db, 'tasks', taskData.id);
        const existingTask = tasks.find(t => t.id === taskData.id);
        const updates: Record<string, unknown> = {
          title: taskData.title,
          duration: taskData.duration,
          due: taskData.due,
          priority: taskData.priority,
        };
        if (taskData.description) {
          updates.description = taskData.description;
        } else {
          updates.description = null;
        }
        // Recalculate endTime if duration changed on a scheduled task
        if (
          existingTask?.startTime &&
          existingTask?.scheduledDate &&
          taskData.duration &&
          taskData.duration !== existingTask.duration
        ) {
          const startDate = new Date(existingTask.startTime);
          const endMs = startDate.getTime() + taskData.duration * 60_000;
          const newEnd = new Date(endMs);
          updates.endTime = buildUTCTime(
            existingTask.scheduledDate,
            newEnd.getUTCHours(),
            newEnd.getUTCMinutes(),
          );
        }
        await updateDoc(taskRef, updates);
        setIsModalOpen(false);
        setEditingTask(null);
        showToast('Task updated', 'success');
      } catch (error) {
        showToast('Failed to save task. Please try again.');
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskData.id}`);
      }
      return;
    }

    // Create new task
    const taskId = crypto.randomUUID();
    const newTask: Record<string, unknown> = {
      id: taskId,
      uid: user.uid,
      title: taskData.title || 'Untitled Task',
      duration: taskData.duration || 60,
      due: taskData.due || getLocalToday(),
      priority: taskData.priority || 'Medium',
      status: 'Pending',
      createdAt: Date.now(),
      schemaVersion: SCHEMA_VERSION,
    };
    if (taskData.description) {
      newTask.description = taskData.description;
    }

    try {
      await setDoc(doc(db, 'tasks', taskId), newTask);
      setIsModalOpen(false);
      setEditingTask(null);
      showToast('Task created', 'success');
    } catch (error) {
      showToast('Failed to save task. Please try again.');
      handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'Pending');
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-surface">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddTask={() => setIsModalOpen(true)}
          pendingCount={pendingTasks.length}
          completedCount={completedCount}
        />
        <TopBar user={user} onError={(msg) => showToast(msg)} />

        <main role="main" aria-label="Dashboard content" className="pl-64 pt-16 min-h-screen">
          {!user ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8">
              <div className="max-w-md text-center bg-white p-10 rounded-3xl shadow-xl border border-white/50">
                <h2 className="text-3xl font-black font-headline text-primary mb-4 uppercase tracking-tight text-center">Planova</h2>
                <p className="text-on-surface-variant mb-8">Drag-and-drop scheduling for your day. Sign in to get started.</p>
                <button
                  onClick={async () => {
                    try { await loginWithGoogle(); }
                    catch { showToast('Sign-in failed. Please try again.'); }
                  }}
                  className="w-full py-4 px-6 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                >
                  Sign in with Google
                </button>
              </div>
            </div>
          ) : (
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
                        <p className="text-sm text-on-surface-variant mb-8">Create your first task and drag it onto the timeline to get started.</p>
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="px-8 py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all"
                        >
                          Create First Task
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <PendingDroppable tasks={pendingTasks} onEditTask={handleEditTask} onDeleteTask={handleDeleteTask} />
                      <Timeline
                        tasks={tasks}
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
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <HistoryView user={user} />
                </motion.div>
              ) : activeTab === 'settings' ? (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <SettingsPage />
                </motion.div>
              ) : null}
            </AnimatePresence>
          )}
        </main>

        <TaskModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
          onSave={handleSaveTask}
          editingTask={editingTask}
        />
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
      </div>
    </DndContext>
  );
}
