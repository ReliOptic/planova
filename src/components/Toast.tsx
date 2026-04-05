import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  readonly message: string;
  readonly type: 'error' | 'success';
  readonly onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bgClass = type === 'error' ? 'bg-tertiary' : 'bg-green-600';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-sm ${bgClass}`}
        role="alert"
      >
        <span className="flex-1">{message}</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 opacity-80 hover:opacity-100 transition-opacity text-white"
        >
          ✕
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
