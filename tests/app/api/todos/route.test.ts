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
});
