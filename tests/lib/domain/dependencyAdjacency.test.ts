import { describe, expect, it } from 'vitest';
import { buildDependencyAdjacency, hasPathInAdjacency } from '@/lib/domain/dependencyAdjacency';

describe('dependencyAdjacency', () => {
  it('builds adjacency lists', () => {
    const adj = buildDependencyAdjacency([
      { dependentId: 2, dependencyId: 1 },
      { dependentId: 2, dependencyId: 3 },
    ]);
    expect(adj.get(2)).toEqual([1, 3]);
    expect(adj.get(1)).toBeUndefined();
  });

  it('detects a direct path', () => {
    const adj = buildDependencyAdjacency([{ dependentId: 2, dependencyId: 1 }]);
    expect(hasPathInAdjacency(adj, 2, 1)).toBe(true);
    expect(hasPathInAdjacency(adj, 1, 2)).toBe(false);
  });

  it('detects a longer path', () => {
    const adj = buildDependencyAdjacency([
      { dependentId: 3, dependencyId: 2 },
      { dependentId: 2, dependencyId: 1 },
    ]);
    expect(hasPathInAdjacency(adj, 3, 1)).toBe(true);
  });
});
