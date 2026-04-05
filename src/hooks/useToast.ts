import { useState, useCallback } from 'react';

interface ToastState {
  readonly message: string;
  readonly type: 'error' | 'success';
}

interface UseToastReturn {
  readonly toast: ToastState | null;
  readonly showToast: (message: string, type?: 'error' | 'success') => void;
  readonly dismissToast: () => void;
}

export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}
