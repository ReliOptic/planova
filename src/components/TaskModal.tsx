import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar as CalendarIcon, ChevronDown, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Priority, Task, type TaskColor } from '@/src/types';
import type { RecurrenceRule, RecurrenceFrequency } from '@/src/types';
import { getDurationOptions, getLocalToday } from '@/src/utils/date-utils';
import { TASK_COLORS, TASK_COLOR_MAP } from '@/src/domain/task';

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
  const [color, setColor] = useState<TaskColor | undefined>(undefined);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [group, setGroup] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setDuration(editingTask.duration);
      setPriority(editingTask.priority);
      setDue(editingTask.due);
      setColor(editingTask.color);
      setGroup(editingTask.group ?? '');
      if (editingTask.recurrenceRule) {
        setRecurrenceEnabled(true);
        setRecurrenceFrequency(editingTask.recurrenceRule.frequency);
        setRecurrenceInterval(editingTask.recurrenceRule.interval);
        setRecurrenceDays([...(editingTask.recurrenceRule.daysOfWeek ?? [])]);
        setRecurrenceEndDate(editingTask.recurrenceRule.endDate ?? '');
      } else {
        setRecurrenceEnabled(false);
        setRecurrenceFrequency('weekly');
        setRecurrenceInterval(1);
        setRecurrenceDays([]);
        setRecurrenceEndDate('');
      }
    } else {
      setTitle('');
      setDescription('');
      setDuration(60);
      setPriority('Medium');
      setDue(getLocalToday());
      setColor(undefined);
      setGroup('');
      setRecurrenceEnabled(false);
      setRecurrenceFrequency('weekly');
      setRecurrenceInterval(1);
      setRecurrenceDays([]);
      setRecurrenceEndDate('');
    }
    setIsSaving(false);
  }, [editingTask, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || duration <= 0 || isSaving) return;

    setIsSaving(true);
    const recurrenceRule: RecurrenceRule | undefined = recurrenceEnabled
      ? {
          frequency: recurrenceFrequency,
          interval: recurrenceInterval,
          ...(recurrenceFrequency === 'weekly' && recurrenceDays.length > 0
            ? { daysOfWeek: recurrenceDays }
            : {}),
          ...(recurrenceEndDate ? { endDate: recurrenceEndDate } : {}),
        }
      : undefined;
    try {
      await onSave({
        ...(editingTask ? { id: editingTask.id } : {}),
        title: title.trim(),
        description: description.trim() || undefined,
        duration,
        priority,
        due,
        color,
        recurrenceRule,
        group: group.trim() || undefined,
      } as Partial<Task>);
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
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {TASK_COLORS.map((c) => {
                    const styles = TASK_COLOR_MAP[c];
                    const isSelected = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(isSelected ? undefined : c)}
                        aria-label={c}
                        className={`w-7 h-7 rounded-full transition-all focus-visible:outline-none ${styles.bg} ${isSelected ? `ring-2 ${styles.ring} ring-offset-2 scale-110` : 'hover:scale-110 opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'}`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">Group</label>
                <input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all"
                  placeholder="예: 업무, 개인, 운동..."
                  maxLength={50}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em]">
                  <button
                    type="button"
                    onClick={() => setRecurrenceEnabled(!recurrenceEnabled)}
                    className="inline-flex items-center gap-1.5 hover:text-primary transition-colors rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <Repeat size={14} className={recurrenceEnabled ? 'text-primary' : ''} />
                    반복 일정
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${recurrenceEnabled ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                      {recurrenceEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </label>
                {recurrenceEnabled && (
                  <div className="space-y-3 p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-on-surface-variant">주기</label>
                        <div className="relative">
                          <select
                            value={recurrenceFrequency}
                            onChange={(e) => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
                            className="w-full px-3 py-2 bg-white border border-outline-variant/20 rounded-md text-sm text-on-surface appearance-none pr-8 focus-visible:ring-2 focus-visible:ring-primary outline-none"
                          >
                            <option value="daily">매일</option>
                            <option value="weekly">매주</option>
                            <option value="monthly">매월</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-on-surface-variant">간격</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-2 bg-white border border-outline-variant/20 rounded-md text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary outline-none"
                        />
                      </div>
                    </div>
                    {recurrenceFrequency === 'weekly' && (
                      <div className="space-y-1">
                        <label className="block text-[10px] text-on-surface-variant">요일 선택</label>
                        <div className="flex gap-1">
                          {['일', '월', '화', '수', '목', '금', '토'].map((label, idx) => {
                            const isSelected = recurrenceDays.includes(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  setRecurrenceDays(
                                    isSelected
                                      ? recurrenceDays.filter((d) => d !== idx)
                                      : [...recurrenceDays, idx].sort((a, b) => a - b),
                                  )
                                }
                                className={`w-8 h-8 rounded-full text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                                  isSelected
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="block text-[10px] text-on-surface-variant">종료일 (선택)</label>
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-outline-variant/20 rounded-md text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary outline-none"
                      />
                    </div>
                  </div>
                )}
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
