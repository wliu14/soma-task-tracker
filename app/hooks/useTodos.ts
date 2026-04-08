'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeSchedule } from '@/lib/scheduling';
import type { TodoWithDeps } from '@/lib/types/todo';
import { sortTodosClient } from '@/lib/client/sortTodos';

type ApiErrorShape = { error?: string };

function readApiError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && typeof (data as ApiErrorShape).error === 'string') {
    return (data as ApiErrorShape).error!;
  }
  return fallback;
}

export interface UseTodosOptions {
  showError: (message: string) => void;
  showTaskError: (taskId: number, message: string) => void;
  dismissTaskError: (taskId: number) => void;
  clearGlobalError: () => void;
}

export function useTodos({
  showError,
  showTaskError,
  dismissTaskError,
  clearGlobalError,
}: UseTodosOptions) {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedDeps, setSelectedDeps] = useState<number[]>([]);
  const [todos, setTodos] = useState<TodoWithDeps[]>([]);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [editedDueDates, setEditedDueDates] = useState<Record<number, string>>({});

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos');
      const data: unknown = await res.json();

      if (!res.ok) {
        showError(readApiError(data, 'Failed to load tasks'));
        setTodos([]);
        return;
      }

      if (!Array.isArray(data)) {
        console.error('Unexpected todos response shape:', data);
        showError('Invalid tasks data received');
        setTodos([]);
        return;
      }

      const sorted = sortTodosClient(data as TodoWithDeps[]);
      setTodos(sorted);
      const imageIds = sorted.filter((t) => Boolean(t.imageUrl)).map((t) => t.id);
      setLoadingImages(new Set(imageIds));
      clearGlobalError();
    } catch (e) {
      console.error('Failed to fetch todos:', e);
      showError('Failed to load tasks');
      setTodos([]);
    }
  }, [showError, clearGlobalError]);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  const earliestStartById = useMemo(() => {
    const { earliestStartDates } = computeSchedule(todos);
    const result = new Map<number, string>();
    todos.forEach((t) => {
      const start = earliestStartDates.get(t.id);
      result.set(t.id, start ? start.toLocaleDateString() : '—');
    });
    return result;
  }, [todos]);

  const handleAddTodo = useCallback(async () => {
    if (!newTodo.trim()) {
      showError('Title is required');
      return;
    }

    try {
      clearGlobalError();
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTodo,
          dueDate: dueDate || null,
          dependencyIds: selectedDeps.length > 0 ? selectedDeps : undefined,
        }),
      });

      if (!res.ok) {
        const data: unknown = await res.json();
        showError(readApiError(data, 'Failed to create task'));
        return;
      }

      setNewTodo('');
      setDueDate('');
      setSelectedDeps([]);
      await fetchTodos();
    } catch (e) {
      console.error('Failed to add todo:', e);
      showError('Failed to create task');
    }
  }, [newTodo, dueDate, selectedDeps, showError, clearGlobalError, fetchTodos]);

  const handleDeleteTodo = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });

        if (!res.ok) {
          const data: unknown = await res.json();
          showTaskError(id, readApiError(data, 'Failed to delete task'));
          return;
        }

        dismissTaskError(id);
        await fetchTodos();
      } catch (e) {
        console.error('Failed to delete todo:', e);
        showTaskError(id, 'Failed to delete task');
      }
    },
    [fetchTodos, showTaskError, dismissTaskError]
  );

  const toggleDependency = useCallback((id: number) => {
    setSelectedDeps((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }, []);

  const runTaskMutation = useCallback(
    async (todoId: number, request: () => Promise<Response>, fallbackMessage: string) => {
      try {
        const res = await request();
        const data: unknown = res.ok ? null : await res.json();

        if (!res.ok) {
          showTaskError(todoId, readApiError(data, fallbackMessage));
          return;
        }

        dismissTaskError(todoId);
        await fetchTodos();
      } catch (e) {
        console.error(fallbackMessage, e);
        showTaskError(todoId, fallbackMessage);
      }
    },
    [fetchTodos, showTaskError, dismissTaskError]
  );

  const handleAddDependency = useCallback(
    (todoId: number, dependencyId: number) => {
      void runTaskMutation(
        todoId,
        () =>
          fetch(`/api/todos/${todoId}/dependencies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dependencyId }),
          }),
        'Failed to add dependency'
      );
    },
    [runTaskMutation]
  );

  const handleRemoveDependency = useCallback(
    (todoId: number, dependencyId: number) => {
      void runTaskMutation(
        todoId,
        () =>
          fetch(`/api/todos/${todoId}/dependencies`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dependencyId }),
          }),
        'Failed to remove dependency'
      );
    },
    [runTaskMutation]
  );

  const handleUpdateDueDate = useCallback(
    (todoId: number) => {
      const raw = editedDueDates[todoId] ?? '';
      void runTaskMutation(
        todoId,
        () =>
          fetch(`/api/todos/${todoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dueDate: raw || null }),
          }),
        'Failed to update due date'
      );
    },
    [editedDueDates, runTaskMutation]
  );

  const toInputDate = useCallback((value: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const isOverdue = useCallback((d: string | null) => {
    if (!d) return false;
    return new Date(d) < new Date();
  }, []);

  const handleImageLoadComplete = useCallback((todoId: number) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(todoId);
      return next;
    });
  }, []);

  return {
    todos,
    newTodo,
    setNewTodo,
    dueDate,
    setDueDate,
    selectedDeps,
    toggleDependency,
    loadingImages,
    editedDueDates,
    setEditedDueDates,
    earliestStartById,
    fetchTodos,
    handleAddTodo,
    handleDeleteTodo,
    handleAddDependency,
    handleRemoveDependency,
    handleUpdateDueDate,
    toInputDate,
    isOverdue,
    handleImageLoadComplete,
  };
}
