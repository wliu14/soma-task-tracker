/**
 * Dependency edges: each row is “dependentId depends on dependencyId”.
 * Traversal follows “what must finish before this task” (outgoing to dependency ids).
 */

export function buildDependencyAdjacency(
  rows: Array<{ dependentId: number; dependencyId: number }>
): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  for (const row of rows) {
    const list = adj.get(row.dependentId);
    if (list) list.push(row.dependencyId);
    else adj.set(row.dependentId, [row.dependencyId]);
  }
  return adj;
}

/** BFS from `from` along edges to dependency ids; true if `to` is reachable. */
export function hasPathInAdjacency(adj: Map<number, number[]>, from: number, to: number): boolean {
  const visited = new Set<number>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const next = adj.get(current);
    if (!next) continue;
    for (const depId of next) {
      queue.push(depId);
    }
  }

  return false;
}
