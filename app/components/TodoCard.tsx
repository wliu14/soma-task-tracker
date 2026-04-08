'use client';

import Image from 'next/image';
import type { TodoWithDeps } from '@/lib/types/todo';

export interface TodoCardProps {
  todo: TodoWithDeps;
  todos: TodoWithDeps[];
  taskError?: string;
  earliestStartLabel: string;
  editedDueDates: Record<number, string>;
  failedImageIds: Set<number>;
  onEditedDueDateChange: (todoId: number, value: string) => void;
  onSaveDueDate: (todoId: number) => void;
  onDelete: (id: number) => void;
  onAddDependency: (todoId: number, dependencyId: number) => void;
  onRemoveDependency: (todoId: number, dependencyId: number) => void;
  onImageLoad: (todoId: number) => void;
  onImageError: (todoId: number) => void;
  isOverdue: (dueDate: string | null) => boolean;
  toInputDate: (value: string | null) => string;
}

export function TodoCard({
  todo,
  todos,
  taskError,
  earliestStartLabel,
  editedDueDates,
  failedImageIds,
  onEditedDueDateChange,
  onSaveDueDate,
  onDelete,
  onAddDependency,
  onRemoveDependency,
  onImageLoad,
  onImageError,
  isOverdue,
  toInputDate,
}: TodoCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition duration-300">
      {taskError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{taskError}</div>
      )}
      <div className="flex gap-6">
        <div className="relative flex-shrink-0 w-32 h-32 bg-gray-200 rounded-lg overflow-hidden">
          {todo.imageUrl && (
            <Image
              src={todo.imageUrl}
              alt={todo.title}
              fill
              sizes="128px"
              className="object-cover"
              onLoad={() => onImageLoad(todo.id)}
              onError={() => onImageError(todo.id)}
            />
          )}

          {(!todo.imageUrl || failedImageIds.has(todo.id)) && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-slate-200 px-1 text-center pointer-events-none"
              role="img"
              aria-label={!todo.imageUrl ? 'No image available' : 'Image could not be loaded'}
            >
              <svg
                className="h-9 w-9 shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden={true}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              <span className="text-[10px] font-medium leading-tight text-slate-500">
                {!todo.imageUrl ? 'No image available' : "Couldn't load image"}
              </span>
            </div>
          )}
        </div>

        <div className="flex-grow">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-bold text-gray-800">{todo.title}</h3>
            <button
              type="button"
              onClick={() => onDelete(todo.id)}
              className="text-red-500 hover:text-red-700 transition duration-300"
              aria-label={`Delete ${todo.title}`}
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

          <div className="mb-3">
            <div
              className={`text-sm font-semibold mb-1 ${
                todo.dueDate
                  ? isOverdue(todo.dueDate)
                    ? 'text-red-600'
                    : 'text-green-600'
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
              Earliest start: <span className="font-semibold">{earliestStartLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                aria-label={`Due date for ${todo.title}`}
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700"
                value={
                  Object.prototype.hasOwnProperty.call(editedDueDates, todo.id)
                    ? editedDueDates[todo.id]
                    : toInputDate(todo.dueDate)
                }
                onChange={(e) => onEditedDueDateChange(todo.id, e.target.value)}
              />
              <button
                type="button"
                onClick={() => onSaveDueDate(todo.id)}
                className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-xs font-semibold"
              >
                Save due date
              </button>
            </div>
          </div>

          {(todo.dependsOn.length > 0 || todo.dependedOnBy.length > 0) && (
            <div className="text-sm text-gray-600 mb-3">
              {todo.dependsOn.length > 0 && (
                <div className="mb-1">
                  <strong>Depends on:</strong> {todo.dependsOn.map((d) => d.dependency.title).join(', ')}
                </div>
              )}
              {todo.dependedOnBy.length > 0 && (
                <div>
                  <strong>Blocked by this task:</strong>{' '}
                  {todo.dependedOnBy.map((d) => d.dependent.title).join(', ')}
                </div>
              )}
            </div>
          )}

          {todos.filter((t) => t.id !== todo.id).length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">
                Add dependency to this task
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded space-y-2">
                {todos
                  .filter((t) => t.id !== todo.id && !todo.dependsOn.some((d) => d.dependencyId === t.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onAddDependency(todo.id, t.id)}
                      className="block w-full text-left text-sm p-2 hover:bg-gray-200 rounded"
                    >
                      {t.title}
                    </button>
                  ))}
              </div>
            </details>
          )}

          {todo.dependsOn.length > 0 && (
            <div className="text-xs mt-2 flex flex-wrap gap-1">
              {todo.dependsOn.map((dep) => (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => onRemoveDependency(todo.id, dep.dependencyId)}
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
  );
}
