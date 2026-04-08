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

  it('slack vs graph highlight: upstream may have float but driver spine still oranges full chain', () => {
    const todos = [
      { id: 1, title: 'A', dueDate: '2026-04-10T12:00:00', dependsOn: [] },
      { id: 2, title: 'B', dueDate: '2026-04-12T12:00:00', dependsOn: [{ dependencyId: 1 }] },
      { id: 3, title: 'C', dueDate: null, dependsOn: [{ dependencyId: 2 }] },
      { id: 4, title: 'D', dueDate: null, dependsOn: [] },
    ];

    const result = computeSchedule(todos, baseNow);
    expect(result.slackDays.get(1)).toBeGreaterThan(0);
    expect(result.slackCriticalNodes.has(1)).toBe(false);
    expect(result.slackCriticalNodes.has(2)).toBe(true);
    expect(result.slackCriticalNodes.has(3)).toBe(true);
    // Graph: driver spine A → B → C to project end
    expect(result.criticalPathNodes.has(1)).toBe(true);
    expect(result.criticalPathNodes.has(2)).toBe(true);
    expect(result.criticalPathNodes.has(3)).toBe(true);
    expect(result.criticalPathNodes.has(4)).toBe(false);
  });

  it('Y sets project end; graph spine includes X even when X has slack', () => {
    const todos = [
      { id: 1, title: 'A', dueDate: null, dependsOn: [] },
      { id: 2, title: 'B', dueDate: null, dependsOn: [{ dependencyId: 1 }] },
      { id: 3, title: 'C', dueDate: null, dependsOn: [{ dependencyId: 2 }] },
      { id: 4, title: 'X', dueDate: null, dependsOn: [] },
      {
        id: 5,
        title: 'Y',
        dueDate: '2026-04-20T12:00:00',
        dependsOn: [{ dependencyId: 4 }],
      },
    ];

    const result = computeSchedule(todos, baseNow);
    expect(result.criticalPathNodes.has(4)).toBe(true);
    expect(result.criticalPathNodes.has(5)).toBe(true);
    expect(result.slackCriticalNodes.has(4)).toBe(false);
    expect(result.slackCriticalNodes.has(5)).toBe(true);
    expect(result.slackDays.get(4)).toBeGreaterThan(0);
    expect(result.criticalPathNodes.has(3)).toBe(false);
  });

  it('marks every task critical on a simple chain with no due-date float', () => {
    const todos = [
      { id: 1, title: 'A', dueDate: null, dependsOn: [] },
      { id: 2, title: 'B', dueDate: null, dependsOn: [{ dependencyId: 1 }] },
      { id: 3, title: 'C', dueDate: null, dependsOn: [{ dependencyId: 2 }] },
    ];
    const result = computeSchedule(todos, baseNow);
    expect(result.criticalPathNodes.has(1)).toBe(true);
    expect(result.criticalPathNodes.has(2)).toBe(true);
    expect(result.criticalPathNodes.has(3)).toBe(true);
    expect(result.slackDays.get(1)).toBe(0);
    expect(result.slackDays.get(2)).toBe(0);
    expect(result.slackDays.get(3)).toBe(0);
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
