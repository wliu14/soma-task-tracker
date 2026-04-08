import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DependencyGraph } from '@/app/components/DependencyGraph';

describe('DependencyGraph', () => {
  const todos = [
    {
      id: 1,
      title: 'Task A',
      dueDate: '2026-04-10T12:00:00',
      dependsOn: [],
      dependedOnBy: [{ dependentId: 2, dependent: { id: 2, title: 'Task B' } }],
    },
    {
      id: 2,
      title: 'Task B',
      dueDate: null,
      dependsOn: [{ dependencyId: 1, dependency: { id: 1, title: 'Task A' } }],
      dependedOnBy: [],
    },
  ];

  it('shows tooltip with earliest start on node click', async () => {
    const { container } = render(<DependencyGraph todos={todos} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
    fireEvent.click(circles[0]);

    expect(await screen.findByText(/Earliest possible start:/)).toBeInTheDocument();
  });

  it('renders directional edges with arrow markers', () => {
    const { container } = render(<DependencyGraph todos={todos} />);

    const line = container.querySelector('line');
    expect(line).toBeTruthy();
    expect(line?.getAttribute('marker-end')).toMatch(/url\(#arrow/);
  });
});
