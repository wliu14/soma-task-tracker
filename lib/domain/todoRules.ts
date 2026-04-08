/**
 * Pure business rules for todo due dates and dependencies.
 * Used by API routes so create/update/edge logic stays consistent.
 */

export interface TodoWithDue {
  title: string;
  dueDate: Date | null;
}

export function validateDueDateAgainstDependencies(
  newDueDate: Date,
  dependencies: TodoWithDue[]
): string | null {
  const depsWithDue = dependencies.filter((d) => d.dueDate !== null);
  if (depsWithDue.length === 0) return null;
  const latestDep = depsWithDue.reduce((latest, current) =>
    latest.dueDate! > current.dueDate! ? latest : current
  );
  if (latestDep.dueDate! > newDueDate) {
    const latestDueStr = latestDep.dueDate!.toLocaleDateString();
    return `Due date must be on or after all dependency due dates. Latest dependency: "${latestDep.title}" due ${latestDueStr}.`;
  }
  return null;
}

export function validateDueDateAgainstDependents(
  newDueDate: Date,
  dependents: TodoWithDue[]
): string | null {
  const dependentsWithDue = dependents.filter((d) => d.dueDate !== null);
  if (dependentsWithDue.length === 0) return null;
  const violating = dependentsWithDue.find((d) => d.dueDate! < newDueDate);
  if (violating) {
    const vDueStr = violating.dueDate!.toLocaleDateString();
    return `Cannot move this task's due date later than a task that depends on it. "${violating.title}" is due on ${vDueStr}.`;
  }
  return null;
}

/** When adding edge dependent -> dependency, both must have due dates and dependent >= dependency. */
export function validateNewDependencyDueOrder(
  dependent: TodoWithDue,
  dependency: TodoWithDue
): string | null {
  if (!dependent.dueDate || !dependency.dueDate) return null;
  if (dependent.dueDate < dependency.dueDate) {
    const depDue = dependency.dueDate.toLocaleDateString();
    return `Cannot add dependency: "${dependency.title}" is due on ${depDue}, which is later than this task's due date.`;
  }
  return null;
}
