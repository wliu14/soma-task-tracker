'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const GLOBAL_ERROR_MS = 10_000;
const TASK_ERROR_MS = 10_000;

export function useTimedErrors() {
  const [error, setError] = useState('');
  const [taskErrors, setTaskErrors] = useState<Record<number, string>>({});
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskErrorTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      // Ref holds one stable Map; read `.current` at unmount so we clear timers created after mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional ref read in cleanup
      const taskTimers = taskErrorTimersRef.current;
      taskTimers.forEach((timer) => clearTimeout(timer));
      taskTimers.clear();
    };
  }, []);

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setError((prev) => (prev === message ? '' : prev));
    }, GLOBAL_ERROR_MS);
  }, []);

  const showTaskError = useCallback((taskId: number, message: string) => {
    setTaskErrors((prev) => ({ ...prev, [taskId]: message }));
    const existing = taskErrorTimersRef.current.get(taskId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setTaskErrors((prev) => {
        if (prev[taskId] !== message) return prev;
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });
      taskErrorTimersRef.current.delete(taskId);
    }, TASK_ERROR_MS);
    taskErrorTimersRef.current.set(taskId, timer);
  }, []);

  const dismissTaskError = useCallback((taskId: number) => {
    const existing = taskErrorTimersRef.current.get(taskId);
    if (existing) clearTimeout(existing);
    taskErrorTimersRef.current.delete(taskId);
    setTaskErrors((prev) => {
      const updated = { ...prev };
      delete updated[taskId];
      return updated;
    });
  }, []);

  const clearGlobalError = useCallback(() => {
    setError('');
  }, []);

  return {
    error,
    taskErrors,
    showError,
    showTaskError,
    dismissTaskError,
    clearGlobalError,
  };
}
