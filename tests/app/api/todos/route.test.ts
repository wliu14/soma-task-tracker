import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  todo: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/todos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects due date earlier than dependency due date', async () => {
    mockPrisma.todo.findMany.mockResolvedValueOnce([
      { id: 2, title: 'Movie', dueDate: new Date('2026-04-22T00:00:00') },
    ]);

    const { POST } = await import('@/app/api/todos/route');
    const req = new Request('http://localhost/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Basketball',
        dueDate: '2026-04-19',
        dependencyIds: [2],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Due date must be on or after all dependency due dates');
  });

  it('rejects missing title', async () => {
    const { POST } = await import('@/app/api/todos/route');
    const req = new Request('http://localhost/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Title is required');
  });

  it('rejects invalid JSON body', async () => {
    const { POST } = await import('@/app/api/todos/route');
    const req = new Request('http://localhost/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('rejects when a dependency id does not exist', async () => {
    mockPrisma.todo.findMany.mockResolvedValueOnce([{ id: 1, title: 'A', dueDate: null }]);

    const { POST } = await import('@/app/api/todos/route');
    const req = new Request('http://localhost/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X', dependencyIds: [1, 99] }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('One or more dependencies do not exist');
  });

  it('rejects dependencyIds when not an array', async () => {
    const { POST } = await import('@/app/api/todos/route');
    const req = new Request('http://localhost/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X', dependencyIds: 1 }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('dependencyIds must be an array');
  });
});
