'use client';

import { DependencyGraph } from './components/DependencyGraph';
import { TaskForm } from './components/TaskForm';
import { TodoCard } from './components/TodoCard';
import { useTimedErrors } from './hooks/useTimedErrors';
import { useTodos } from './hooks/useTodos';

export default function Home() {
  const { error, taskErrors, showError, showTaskError, dismissTaskError, clearGlobalError } =
    useTimedErrors();

  const todosState = useTodos({
    showError,
    showTaskError,
    dismissTaskError,
    clearGlobalError,
  });

  const {
    todos,
    newTodo,
    setNewTodo,
    dueDate,
    setDueDate,
    selectedDeps,
    toggleDependency,
    failedImageIds,
    editedDueDates,
    setEditedDueDates,
    earliestStartById,
    handleAddTodo,
    handleDeleteTodo,
    handleAddDependency,
    handleRemoveDependency,
    handleUpdateDueDate,
    toInputDate,
    isOverdue,
    handleImageLoad,
    handleImageError,
  } = todosState;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Things To Do App</h1>

        <TaskForm
          error={error}
          newTodo={newTodo}
          dueDate={dueDate}
          selectedDeps={selectedDeps}
          todos={todos}
          onNewTodoChange={setNewTodo}
          onDueDateChange={setDueDate}
          onToggleDependency={toggleDependency}
          onAddTask={handleAddTodo}
        />

        <div className="space-y-4 mb-8">
          {todos.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No tasks yet. Create one to get started!</p>
            </div>
          ) : (
            todos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                todos={todos}
                taskError={taskErrors[todo.id]}
                earliestStartLabel={earliestStartById.get(todo.id) || '—'}
                editedDueDates={editedDueDates}
                failedImageIds={failedImageIds}
                onEditedDueDateChange={(id, value) =>
                  setEditedDueDates((prev) => ({ ...prev, [id]: value }))
                }
                onSaveDueDate={handleUpdateDueDate}
                onDelete={handleDeleteTodo}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
                onImageLoad={handleImageLoad}
                onImageError={handleImageError}
                isOverdue={isOverdue}
                toInputDate={toInputDate}
              />
            ))
          )}
        </div>

        {todos.length > 0 && <DependencyGraph todos={todos} />}
      </div>
    </div>
  );
}
