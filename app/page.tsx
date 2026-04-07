'use client';
import Image from 'next/image';
import { useMemo, useState, useEffect, useRef } from 'react';
import { DependencyGraph } from './components/DependencyGraph';

interface TodoWithDeps {
  id: number;
  title: string;
  dueDate: string | null;
  imageUrl: string | null;
  createdAt: string;
  dependsOn: Array<{
    id: number;
    dependentId: number;
    dependencyId: number;
    dependency: { id: number; title: string };
  }>;
  dependedOnBy: Array<{
    id: number;
    dependentId: number;
    dependencyId: number;
    dependent: { id: number; title: string };
  }>;
}

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedDeps, setSelectedDeps] = useState<number[]>([]);
  const [todos, setTodos] = useState<TodoWithDeps[]>([]);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [taskErrors, setTaskErrors] = useState<Record<number, string>>({});
  const [editedDueDates, setEditedDueDates] = useState<Record<number, string>>({});
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskErrorTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      taskErrorTimersRef.current.forEach(timer => clearTimeout(timer));
      taskErrorTimersRef.current.clear();
    };
  }, []);

  const showError = (message: string) => {
    setError(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setError(prev => (prev === message ? '' : prev));
    }, 10_000);
  };

  const showTaskError = (taskId: number, message: string) => {
    setTaskErrors(prev => ({ ...prev, [taskId]: message }));
    const existing = taskErrorTimersRef.current.get(taskId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setTaskErrors(prev => {
        if (prev[taskId] !== message) return prev;
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });
      taskErrorTimersRef.current.delete(taskId);
    }, 10_000);
    taskErrorTimersRef.current.set(taskId, timer);
  };

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();

      if (!res.ok) {
        const message = (data && typeof data.error === 'string') ? data.error : 'Failed to load tasks';
        showError(message);
        setTodos([]);
        return;
      }

      if (!Array.isArray(data)) {
        console.error('Unexpected todos response shape:', data);
        showError('Invalid tasks data received');
        setTodos([]);
        return;
      }

      const sorted = [...data].sort((a: TodoWithDeps, b: TodoWithDeps) => {
        const aDue = a.dueDate ? new Date(a.dueDate) : null;
        const bDue = b.dueDate ? new Date(b.dueDate) : null;
        const aHas = Boolean(aDue && !Number.isNaN(aDue.getTime()));
        const bHas = Boolean(bDue && !Number.isNaN(bDue.getTime()));

        // tasks with due dates first
        if (aHas !== bHas) return aHas ? -1 : 1;

        // both have due dates: earliest first
        if (aHas && bHas) {
          const diff = aDue!.getTime() - bDue!.getTime();
          if (diff !== 0) return diff;
        }

        // tie-breaker: newer first
        const aCreated = new Date(a.createdAt).getTime();
        const bCreated = new Date(b.createdAt).getTime();
        return bCreated - aCreated;
      });

      setTodos(sorted);
      // mark all tasks with images as "loading" so the skeleton appears
      const imageIds = sorted
        .filter((t: TodoWithDeps) => Boolean(t.imageUrl))
        .map((t: TodoWithDeps) => t.id);
      setLoadingImages(new Set(imageIds));
      setError('');
    } catch (error) {
      console.error('Failed to fetch todos:', error);
      showError('Failed to load tasks');
      setTodos([]);
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const earliestStartById = useMemo(() => {
    // Earliest start date is constrained by:
    // - dependency chain (a task can't start before its dependencies can start)
    // - dependency due dates (a task can't start before a dependency is due)
    const today = new Date();
    const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;

    const byId = new Map<number, TodoWithDeps>();
    todos.forEach(t => byId.set(t.id, t));

    const dueOffset = new Map<number, number>();
    todos.forEach(t => {
      if (!t.dueDate) {
        dueOffset.set(t.id, 0);
        return;
      }
      const d = new Date(t.dueDate);
      if (Number.isNaN(d.getTime())) {
        dueOffset.set(t.id, 0);
        return;
      }
      const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.round((localMidnight.getTime() - baseDate.getTime()) / msPerDay);
      dueOffset.set(t.id, Math.max(0, diffDays));
    });

    const inDegree = new Map<number, number>();
    const adj = new Map<number, number[]>();
    const depsByNode = new Map<number, number[]>();

    todos.forEach(t => {
      inDegree.set(t.id, 0);
      adj.set(t.id, []);
      depsByNode.set(t.id, []);
    });

    todos.forEach(t => {
      t.dependsOn.forEach(dep => {
        // dep.dependencyId -> t.id
        adj.get(dep.dependencyId)?.push(t.id);
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
        depsByNode.get(t.id)?.push(dep.dependencyId);
      });
    });

    const q: number[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) q.push(id);
    });

    const earliestDays = new Map<number, number>();
    q.forEach(id => earliestDays.set(id, 0));

    while (q.length > 0) {
      const cur = q.shift()!;
      const neighbors = adj.get(cur) || [];
      neighbors.forEach(n => {
        const deps = depsByNode.get(n) || [];
        let best = 0;
        if (deps.length > 0) {
          best = Math.max(
            ...deps.map(depId => Math.max(earliestDays.get(depId) || 0, dueOffset.get(depId) || 0))
          );
        }
        const existing = earliestDays.get(n);
        if (existing === undefined || best > existing) earliestDays.set(n, best);

        inDegree.set(n, (inDegree.get(n) || 0) - 1);
        if (inDegree.get(n) === 0) q.push(n);
      });
    }

    const result = new Map<number, string>();
    todos.forEach(t => {
      const off = earliestDays.get(t.id) || 0;
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() + off);
      result.set(t.id, start.toLocaleDateString());
    });

    return result;
  }, [todos]);

  const handleAddTodo = async () => {
    if (!newTodo.trim()) {
      showError('Title is required');
      return;
    }

    try {
      setError('');
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
        const err = await res.json();
        showError(err.error || 'Failed to create task');
        return;
      }

      setNewTodo('');
      setDueDate('');
      setSelectedDeps([]);
      await fetchTodos();
    } catch (error) {
      console.error('Failed to add todo:', error);
      showError('Failed to create task');
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        const errorMsg = err.error || 'Failed to delete task';
        showTaskError(id, errorMsg);
        return;
      }

      setTaskErrors(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      await fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
      showTaskError(id, 'Failed to delete task');
    }
  };

  const toggleDependency = (id: number) => {
    setSelectedDeps(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleAddDependency = async (todoId: number, dependencyId: number) => {
    try {
      const res = await fetch(`/api/todos/${todoId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId }),
      });

      if (!res.ok) {
        const err = await res.json();
        const errorMsg = err.error || 'Failed to add dependency';
        showTaskError(todoId, errorMsg);
        return;
      }

      setTaskErrors(prev => {
        const updated = { ...prev };
        delete updated[todoId];
        return updated;
      });
      await fetchTodos();
    } catch (error) {
      console.error('Failed to add dependency:', error);
      showTaskError(todoId, 'Failed to add dependency');
    }
  };

  const handleRemoveDependency = async (todoId: number, dependencyId: number) => {
    try {
      const res = await fetch(`/api/todos/${todoId}/dependencies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId }),
      });

      if (!res.ok) {
        showTaskError(todoId, 'Failed to remove dependency');
        return;
      }

      setTaskErrors(prev => {
        const updated = { ...prev };
        delete updated[todoId];
        return updated;
      });
      await fetchTodos();
    } catch (error) {
      console.error('Failed to remove dependency:', error);
      showTaskError(todoId, 'Failed to remove dependency');
    }
  };

  const toInputDate = (value: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleUpdateDueDate = async (todoId: number) => {
    const raw = editedDueDates[todoId] ?? '';
    const body = { dueDate: raw || null };

    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = err.error || 'Failed to update due date';
        showTaskError(todoId, msg);
        return;
      }

      setTaskErrors(prev => {
        const updated = { ...prev };
        delete updated[todoId];
        return updated;
      });
      await fetchTodos();
    } catch (error) {
      console.error('Failed to update due date:', error);
      showTaskError(todoId, 'Failed to update due date');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Things To Do App</h1>

        {/* Form Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Task</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Title
              </label>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700"
                placeholder="Enter task title"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
              />
            </div>

            {/* Due Date Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date (Optional)
              </label>
              <input
                type="date"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Dependencies Multi-Select */}
            {todos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dependencies (Optional)
                </label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {todos.length === 0 ? (
                    <p className="text-gray-500 text-sm">No existing tasks</p>
                  ) : (
                    <div className="space-y-2">
                      {todos.map(todo => (
                        <label key={todo.id} className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDeps.includes(todo.id)}
                            onChange={() => toggleDependency(todo.id)}
                            className="mr-2 rounded"
                          />
                          <span className="text-gray-700">{todo.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddTodo}
              className="w-full bg-orange-500 text-white p-3 rounded-lg hover:bg-orange-600 transition duration-300 font-semibold"
            >
              Add Task
            </button>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-4 mb-8">
          {todos.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No tasks yet. Create one to get started!</p>
            </div>
          ) : (
            todos.map(todo => (
              <div
                key={todo.id}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition duration-300"
              >
                {taskErrors[todo.id] && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {taskErrors[todo.id]}
                  </div>
                )}
                <div className="flex gap-6">
                  {/* Image Section */}
                  {todo.imageUrl && (
                    <div className="flex-shrink-0 w-32 h-32 bg-gray-200 rounded-lg overflow-hidden">
                      <Image
                        src={todo.imageUrl}
                        alt={todo.title}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                        onLoadingComplete={() => {
                          setLoadingImages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(todo.id);
                            return newSet;
                          });
                        }}
                      />
                      {loadingImages.has(todo.id) && (
                        <div className="w-full h-full bg-gray-300 animate-pulse"></div>
                      )}
                    </div>
                  )}

                  {/* Content Section */}
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold text-gray-800">{todo.title}</h3>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="text-red-500 hover:text-red-700 transition duration-300"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Due Date */}
                    <div className="mb-3">
                      <div
                        className={`text-sm font-semibold mb-1 ${
                          todo.dueDate
                            ? (isOverdue(todo.dueDate) ? 'text-red-600' : 'text-green-600')
                            : 'text-gray-500'
                        }`}
                      >
                        {todo.dueDate ? (
                          <>
                            Due: {new Date(todo.dueDate).toLocaleDateString()}
                            {isOverdue(todo.dueDate) && ' (OVERDUE)'}
                          </>
                        ) : (
                          <>Due: No due date</>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        Earliest start: <span className="font-semibold">{earliestStartById.get(todo.id) || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <input
                          type="date"
                          className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700"
                          value={
                            Object.prototype.hasOwnProperty.call(editedDueDates, todo.id)
                              ? editedDueDates[todo.id]
                              : toInputDate(todo.dueDate)
                          }
                          onChange={(e) =>
                            setEditedDueDates(prev => ({
                              ...prev,
                              [todo.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateDueDate(todo.id)}
                          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-xs font-semibold"
                        >
                          Save due date
                        </button>
                      </div>
                    </div>

                    {/* Dependencies Display */}
                    {(todo.dependsOn.length > 0 || todo.dependedOnBy.length > 0) && (
                      <div className="text-sm text-gray-600 mb-3">
                        {todo.dependsOn.length > 0 && (
                          <div className="mb-1">
                            <strong>Depends on:</strong>{' '}
                            {todo.dependsOn.map(d => d.dependency.title).join(', ')}
                          </div>
                        )}
                        {todo.dependedOnBy.length > 0 && (
                          <div>
                            <strong>Depended by:</strong>{' '}
                            {todo.dependedOnBy.map(d => d.dependent.title).join(', ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add Dependency Button */}
                    {todos.filter(t => t.id !== todo.id).length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">
                          Add dependency to this task
                        </summary>
                        <div className="mt-2 p-3 bg-gray-100 rounded space-y-2">
                          {todos
                            .filter(
                              t =>
                                t.id !== todo.id &&
                                !todo.dependsOn.some(d => d.dependencyId === t.id)
                            )
                            .map(t => (
                              <button
                                key={t.id}
                                onClick={() => handleAddDependency(todo.id, t.id)}
                                className="block w-full text-left text-sm p-2 hover:bg-gray-200 rounded"
                              >
                                {t.title}
                              </button>
                            ))}
                        </div>
                      </details>
                    )}

                    {/* Remove Dependency Buttons */}
                    {todo.dependsOn.length > 0 && (
                      <div className="text-xs mt-2 flex flex-wrap gap-1">
                        {todo.dependsOn.map(dep => (
                          <button
                            key={dep.id}
                            onClick={() => handleRemoveDependency(todo.id, dep.dependencyId)}
                            className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition"
                          >
                            Remove: {dep.dependency.title} ✕
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Dependency Graph */}
        {todos.length > 0 && <DependencyGraph todos={todos} />}
      </div>
    </div>
  );
}
