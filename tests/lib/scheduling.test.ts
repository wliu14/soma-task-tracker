import { describe, expect, it } from 'vitest';
import { computeSchedule } from '@/lib/scheduling';

describe('computeSchedule', () => {
  const baseNow = new Date('2026-04-06T12:00:00.000Z');

  it('returns today for independent tasks', () => {
    const todos = [
      { id: 1, title: 'A', dueDate: null, dependsOn: [] },
      { id: 2, title: 'B', dueDate: null, dependsOn: [] },
    ];

    const result = computeSchedule(todos, baseNow);
    expect(result.earliestStartDays.get(1)).toBe(0);
    expect(result.earliestStartDays.get(2)).toBe(0);
  });

  it('enforces dependency due date as earliest start lower-bound', () => {
    const todos = [
      { id: 1, title: 'Dependency', dueDate: '2026-04-16T12:00:00', dependsOn: [] },
      { id: 2, title: 'Dependent', dueDate: null, dependsOn: [{ dependencyId: 1 }] },
    ];

    const result = computeSchedule(todos, baseNow);
    expect(result.earliestStartDays.get(2)).toBe(10);
  });

  it('computes a critical path through the longest constrained chain', () => {
    const todos = [
      { id: 1, title: 'A', dueDate: '2026-04-10T12:00:00', dependsOn: [] },
      { id: 2, title: 'B', dueDate: '2026-04-12T12:00:00', dependsOn: [{ dependencyId: 1 }] },
      { id: 3, title: 'C', dueDate: null, dependsOn: [{ dependencyId: 2 }] },
      { id: 4, title: 'D', dueDate: null, dependsOn: [] },
    ];

    const result = computeSchedule(todos, baseNow);
    expect(result.criticalPathNodes.has(1)).toBe(true);
    expect(result.criticalPathNodes.has(2)).toBe(true);
    expect(result.criticalPathNodes.has(3)).toBe(true);
    expect(result.criticalPathNodes.has(4)).toBe(false);
  });

  it('propagates duration through dependency chains', () => {
    const todos = [
      {
        id: 1,
        title: 'Long task',
        dueDate: null,
        estimatedDurationDays: 3,
        dependsOn: [],
      },
      {
        id: 2,
        title: 'Follow-up',
        dueDate: null,
        estimatedDurationDays: 2,
        dependsOn: [{ dependencyId: 1 }],
      },
    ];

    const result = computeSchedule(todos, baseNow);
    expect(result.earliestStartDays.get(1)).toBe(0);
    expect(result.earliestStartDays.get(2)).toBe(3);
  });
});
