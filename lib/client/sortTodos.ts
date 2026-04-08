import type { TodoWithDeps } from '@/lib/types/todo';

/** Client-side ordering: due dates first (earliest), then newer created first. */
export function sortTodosClient(data: TodoWithDeps[]): TodoWithDeps[] {
  return [...data].sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate) : null;
    const bDue = b.dueDate ? new Date(b.dueDate) : null;
    const aHas = Boolean(aDue && !Number.isNaN(aDue.getTime()));
    const bHas = Boolean(bDue && !Number.isNaN(bDue.getTime()));

    if (aHas !== bHas) return aHas ? -1 : 1;

    if (aHas && bHas) {
      const diff = aDue!.getTime() - bDue!.getTime();
      if (diff !== 0) return diff;
    }

    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    return bCreated - aCreated;
  });
}
