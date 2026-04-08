import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    todoDependency: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    todo: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { POST } from '@/app/api/todos/[id]/dependencies/route';

describe('POST /api/todos/[id]/dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    mockPrisma.todoDependency.findMany.mockResolvedValueOnce([{ dependencyId: 1 }]);

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
    mockPrisma.todo.findUnique.mockResolvedValueOnce({ title: 'A', dueDate: null });
    mockPrisma.todo.findUnique.mockResolvedValueOnce({ title: 'B', dueDate: null });
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
