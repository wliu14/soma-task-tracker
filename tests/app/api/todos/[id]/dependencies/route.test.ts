import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    todoDependency: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    todo: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { DELETE, POST } from '@/app/api/todos/[id]/dependencies/route';

function resetPrismaMocks() {
  mockPrisma.todoDependency.findMany.mockReset();
  mockPrisma.todoDependency.findFirst.mockReset();
  mockPrisma.todoDependency.create.mockReset();
  mockPrisma.todoDependency.deleteMany.mockReset();
  mockPrisma.todo.findUnique.mockReset();
}

describe('/api/todos/[id]/dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMocks();
  });

  describe('POST', () => {
    it('rejects invalid dependency id', async () => {
      const req = new Request('http://localhost/api/todos/1/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId: 'abc' }),
      });

      const res = await POST(req, { params: { id: '1' } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid dependency ID');
    });

    it('rejects circular dependencies', async () => {
      // Full graph: task 2 depends on 1. Adding "1 depends on 2" would close a cycle.
      mockPrisma.todoDependency.findMany.mockResolvedValueOnce([
        { dependentId: 2, dependencyId: 1 },
      ]);
      mockPrisma.todo.findUnique.mockResolvedValueOnce({ title: 'A', dueDate: null });
      mockPrisma.todo.findUnique.mockResolvedValueOnce({ title: 'B', dueDate: null });
      mockPrisma.todoDependency.findFirst.mockResolvedValueOnce(null);

      const req = new Request('http://localhost/api/todos/1/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId: 2 }),
      });

      const res = await POST(req, { params: { id: '1' } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('circular reference');
    });

    it('rejects duplicate dependencies', async () => {
      mockPrisma.todoDependency.findMany.mockResolvedValueOnce([]);
      mockPrisma.todo.findUnique
        .mockResolvedValueOnce({ title: 'A', dueDate: null })
        .mockResolvedValueOnce({ title: 'B', dueDate: null });
      mockPrisma.todoDependency.findFirst.mockResolvedValueOnce({ id: 10 });

      const req = new Request('http://localhost/api/todos/1/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId: 2 }),
      });

      const res = await POST(req, { params: { id: '1' } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('This dependency already exists');
    });
  });

  describe('DELETE', () => {
    it('rejects invalid dependency id', async () => {
      const req = new Request('http://localhost/api/todos/1/dependencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId: 'nope' }),
      });
      const res = await DELETE(req, { params: { id: '1' } });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid dependency ID');
    });

    it('rejects invalid JSON', async () => {
      const req = new Request('http://localhost/api/todos/1/dependencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'x',
      });
      const res = await DELETE(req, { params: { id: '1' } });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid JSON body');
    });

    it('returns 404 when the dependency edge does not exist', async () => {
      mockPrisma.todoDependency.deleteMany.mockResolvedValueOnce({ count: 0 });

      const req = new Request('http://localhost/api/todos/1/dependencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId: 2 }),
      });
      const res = await DELETE(req, { params: { id: '1' } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Dependency not found');
    });

    it('returns 200 when the edge is removed', async () => {
      mockPrisma.todoDependency.deleteMany.mockResolvedValueOnce({ count: 1 });

      const req = new Request('http://localhost/api/todos/1/dependencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId: 2 }),
      });
      const res = await DELETE(req, { params: { id: '1' } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe('Dependency removed');
    });
  });
});
