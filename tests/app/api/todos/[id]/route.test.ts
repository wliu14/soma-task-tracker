import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    todo: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { PATCH } from '@/app/api/todos/[id]/route';

describe('PATCH /api/todos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects due date violating dependency ordering', async () => {
    mockPrisma.todo.findUnique.mockResolvedValueOnce({
      id: 1,
      dependsOn: [
        { dependency: { title: 'Movie', dueDate: new Date('2026-04-22T00:00:00') } },
      ],
      dependedOnBy: [],
    });

    const req = new Request('http://localhost/api/todos/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: '2026-04-19' }),
    });

    const res = await PATCH(req, { params: { id: '1' } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Due date must be on or after all dependency due dates');
  });

  it('accepts valid due date update', async () => {
    mockPrisma.todo.findUnique.mockResolvedValueOnce({
      id: 1,
      dependsOn: [],
      dependedOnBy: [],
    });
    mockPrisma.todo.update.mockResolvedValueOnce({ id: 1, dueDate: new Date('2026-04-19T00:00:00') });

    const req = new Request('http://localhost/api/todos/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: '2026-04-19' }),
    });

    const res = await PATCH(req, { params: { id: '1' } });

    expect(res.status).toBe(200);
    expect(mockPrisma.todo.update).toHaveBeenCalledOnce();
  });
});
