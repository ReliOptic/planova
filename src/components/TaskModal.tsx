import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Priority, Task } from '@/src/types';
import { getDurationOptions, getLocalToday } from '@/src/utils/date-utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void | Promise<void>;
  editingTask?: Task | null;
}

const durationOptions = getDurationOptions();

export const TaskModal: React.FC<ModalProps> = ({ isOpen, onClose, onSave, editingTask }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [priority, setPriority] = useState<Priority>('Medium');
  const [due, setDue] = useState(getLocalToday());
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setDuration(editingTask.duration);
      setPriority(editingTask.priority);
      setDue(editingTask.due);
    } else {
      setTitle('');
      setDescription('');
      setDuration(60);
      setPriority('Medium');
      setDue(getLocalToday());
    }
    setIsSaving(false);
  }, [editingTask, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || duration <= 0 || isSaving) return;

    setIsSaving(true);
    try {
      await onSave({
        ...(editingTask ? { id: editingTask.id } : {}),
        title: title.trim(),
        description: description.trim() || undefined,
        duration,
        priority,
        due,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-surface/10 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="w-full max-w-xl bg-white/90 backdrop-blur-2xl rounded-xl overflow-hidden shadow-2xl relative z-10"
          >
            <div className="px-8 pt-8 pb-6 flex justify-between items-start">
              <div>
                <h2 id="modal-title" className="text-2xl font-headline font-bold text-on-surface">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  {editingTask ? 'Edit title, duration, or deadline.' : 'Add a task to your backlog.'}
                </p>
              </div>
              <button onClick={onClose} aria-label="모달 닫기" className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
                <X size={24} />
              </button>
            </div>

            <form className="px-8 pb-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">Task Name</label>
                <input
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                  placeholder="e.g., Review PR #42"
                  type="text"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">Duration</label>
                  <div className="relative">
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface appearance-none pr-10 focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                    >
                      {durationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">Priority</label>
                  <div className="relative">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface appearance-none focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">Deadline</label>
                <div className="relative">
                  <input
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface pr-10 focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                    type="date"
                  />
                  <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">Task Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface resize-none focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                  placeholder="Optional notes or context..."
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm font-semibold text-on-surface hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-2.5 bg-gradient-to-br from-primary to-primary-container text-white text-sm font-bold rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none"
                >
                  {isSaving ? 'Saving...' : editingTask ? 'Update Task' : 'Save Task'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
