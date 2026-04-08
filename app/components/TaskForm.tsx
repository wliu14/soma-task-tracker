'use client';

import type { TodoWithDeps } from '@/lib/types/todo';

export interface TaskFormProps {
  error: string;
  newTodo: string;
  dueDate: string;
  selectedDeps: number[];
  todos: TodoWithDeps[];
  onNewTodoChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onToggleDependency: (id: number) => void;
  onAddTask: () => void;
}

export function TaskForm({
  error,
  newTodo,
  dueDate,
  selectedDeps,
  todos,
  onNewTodoChange,
  onDueDateChange,
  onToggleDependency,
  onAddTask,
}: TaskFormProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Task</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Task Title</label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700"
            placeholder="Enter task title"
            value={newTodo}
            onChange={(e) => onNewTodoChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddTask()}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Due Date (Optional)</label>
          <input
            type="date"
            aria-label="New task due date"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
          />
        </div>

        {todos.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dependencies (Optional)</label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {todos.map((todo) => (
                  <label key={todo.id} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDeps.includes(todo.id)}
                      onChange={() => onToggleDependency(todo.id)}
                      className="mr-2 rounded"
                    />
                    <span className="text-gray-700">{todo.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onAddTask}
          className="w-full bg-orange-500 text-white p-3 rounded-lg hover:bg-orange-600 transition duration-300 font-semibold"
        >
          Add Task
        </button>
      </div>
    </div>
  );
}
