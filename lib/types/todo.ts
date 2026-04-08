/**
 * Shared shape for todos returned from GET /api/todos (client + graph).
 */
export interface TodoWithDeps {
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
