import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TaskCard } from './components/TaskCard';
import { Timeline } from './components/Timeline';
import { TaskModal } from './components/TaskModal';
import { HistoryView } from './components/HistoryView';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { Task } from './types';
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
  orderBy
} from 'firebase/firestore';

const PendingDroppable: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
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
          <TaskCard key={task.id} task={task} />
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

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
      snapshot.forEach((doc) => {
        taskList.push(doc.data() as Task);
      });
      setTasks(taskList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !user) return;

    const taskId = active.id.toString();
    const taskRef = doc(db, 'tasks', taskId);

    try {
      if (over.id.toString().startsWith('slot-')) {
        const slotHour = over.data.current?.hour;
        const hours = [
          '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
          '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'
        ];
        const startIndex = hours.indexOf(slotHour);
        const endIndex = Math.min(startIndex + 1, hours.length - 1);
        const endTime = hours[endIndex];

        await updateDoc(taskRef, {
          status: 'In Progress',
          startTime: slotHour,
          endTime: endTime,
        });
      } 
      else if (over.id === 'pending-column') {
        await updateDoc(taskRef, {
          status: 'Pending',
          startTime: null,
          endTime: null,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!user) return;
    
    const taskId = crypto.randomUUID();
    const newTask: Task = {
      id: taskId,
      uid: user.uid,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      duration: taskData.duration || '1h',
      due: taskData.due || 'Today',
      priority: taskData.priority || 'Medium',
      status: 'Pending',
      createdAt: Date.now(),
      ...taskData
    } as Task;

    try {
      await setDoc(doc(db, 'tasks', taskId), newTask);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'Pending');

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
        />
        <TopBar user={user} />
        
        <main className="pl-64 pt-16 min-h-screen">
          {!user ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8">
              <div className="max-w-md text-center bg-white p-10 rounded-3xl shadow-xl border border-white/50">
                <h2 className="text-3xl font-black font-headline text-primary mb-4 uppercase tracking-tight text-center">Planova</h2>
                <p className="text-on-surface-variant mb-8">Professional workspace for planners and architects. Sign in to manage your projects and schedule.</p>
                <button 
                  onClick={() => loginWithGoogle()}
                  className="w-full py-4 px-6 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                >
                  <img src="https://www.gstatic.com/firebase/anonymous-scan.png" className="w-6 h-6 invert" alt="" />
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
                  <PendingDroppable tasks={pendingTasks} />
                  <Timeline tasks={tasks} />
                </motion.div>
              ) : activeTab === 'history' ? (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <HistoryView />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center h-[calc(100vh-4rem)] text-on-surface-variant"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold font-headline mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View</h3>
                    <p>This section is under construction.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>

        <TaskModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveTask}
        />

        {/* Decorative Background Image */}
        <div className="fixed bottom-0 right-0 w-1/3 h-1/2 opacity-5 pointer-events-none -z-10 overflow-hidden">
          <img
            alt="Architectural sketch"
            className="object-cover w-full h-full grayscale"
            src="https://images.unsplash.com/photo-1503387762-592dee58c460?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </DndContext>
  );
}
