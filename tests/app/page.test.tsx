import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: any) => <img alt={props.alt} src={props.src} />,
}));

import Home from '@/app/page';

const ok = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => data,
  } as Response);

const bad = (data: unknown) =>
  Promise.resolve({
    ok: false,
    json: async () => data,
  } as Response);

describe('Home page key flows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits create task with due date', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockImplementationOnce(() => ok([]))
      .mockImplementationOnce(() => ok({ id: 1 }))
      .mockImplementationOnce(() => ok([]));

    const { container } = render(<Home />);

    fireEvent.change(screen.getByPlaceholderText('Enter task title'), {
      target: { value: 'Buy groceries' },
    });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], {
      target: { value: '2026-04-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/todos',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"dueDate":"2026-04-20"'),
        })
      );
    });
  });

  it('updates due date from task card', async () => {
    const todos = [
      {
        id: 1,
        title: 'Task A',
        dueDate: null,
        imageUrl: null,
        createdAt: '2026-04-06T00:00:00Z',
        dependsOn: [],
        dependedOnBy: [],
      },
    ];

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockImplementationOnce(() => ok(todos))
      .mockImplementationOnce(() => ok({ id: 1, dueDate: '2026-04-18' }))
      .mockImplementationOnce(() => ok(todos));

    const { container } = render(<Home />);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Save due date' }).length).toBeGreaterThan(0);
    });

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save due date' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/todos/1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"dueDate":"2026-04-18"'),
        })
      );
    });
  });

  it('shows localized dependency error near the task card', async () => {
    const todos = [
      {
        id: 1,
        title: 'Task A',
        dueDate: null,
        imageUrl: null,
        createdAt: '2026-04-06T00:00:00Z',
        dependsOn: [],
        dependedOnBy: [],
      },
      {
        id: 2,
        title: 'Task B',
        dueDate: null,
        imageUrl: null,
        createdAt: '2026-04-06T00:00:00Z',
        dependsOn: [],
        dependedOnBy: [],
      },
    ];

    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() => ok(todos))
      .mockImplementationOnce(() => bad({ error: 'Adding this dependency would create a circular reference' }));

    render(<Home />);

    const summaries = await screen.findAllByText('Add dependency to this task');
    fireEvent.click(summaries[0]);
    const depButtons = await screen.findAllByRole('button', { name: 'Task B' });
    fireEvent.click(depButtons[0]);

    expect(await screen.findByText('Adding this dependency would create a circular reference')).toBeInTheDocument();
  });
});
