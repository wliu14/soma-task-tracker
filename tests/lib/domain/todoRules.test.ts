import { describe, expect, it } from 'vitest';
import {
  validateDueDateAgainstDependencies,
  validateDueDateAgainstDependents,
  validateNewDependencyDueOrder,
} from '@/lib/domain/todoRules';

describe('validateDueDateAgainstDependencies', () => {
  it('returns null when no dependency due dates', () => {
    expect(
      validateDueDateAgainstDependencies(new Date('2026-04-10'), [
        { title: 'A', dueDate: null },
      ])
    ).toBeNull();
  });

  it('returns error when new date is before latest dependency due', () => {
    const msg = validateDueDateAgainstDependencies(new Date('2026-04-10'), [
      { title: 'Late', dueDate: new Date('2026-04-20') },
    ]);
    expect(msg).toContain('Due date must be on or after');
    expect(msg).toContain('Late');
  });
});

describe('validateDueDateAgainstDependents', () => {
  it('returns error when dependent is due before new parent due', () => {
    const msg = validateDueDateAgainstDependents(new Date('2026-04-30'), [
      { title: 'Child', dueDate: new Date('2026-04-15') },
    ]);
    expect(msg).toContain('Cannot move');
  });
});

describe('validateNewDependencyDueOrder', () => {
  it('returns null when either due is missing', () => {
    expect(
      validateNewDependencyDueOrder(
        { title: 'B', dueDate: null },
        { title: 'A', dueDate: new Date('2026-04-20') }
      )
    ).toBeNull();
  });

  it('returns error when dependent due is before dependency due', () => {
    const msg = validateNewDependencyDueOrder(
      { title: 'B', dueDate: new Date('2026-04-10') },
      { title: 'A', dueDate: new Date('2026-04-20') }
    );
    expect(msg).toContain('Cannot add dependency');
  });
});
