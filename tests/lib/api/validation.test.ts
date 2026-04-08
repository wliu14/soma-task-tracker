import { describe, expect, it } from 'vitest';
import {
  parseCreateTodoBody,
  parseDateOnlyString,
  parseDependencyIds,
  parseOptionalDueDateField,
  parsePositiveIntField,
  parsePositiveIntParam,
} from '@/lib/api/validation';

describe('parsePositiveIntParam', () => {
  it('accepts positive integers', () => {
    expect(parsePositiveIntParam('1')).toBe(1);
    expect(parsePositiveIntParam('42')).toBe(42);
  });

  it('rejects non-integers and partial parseInt pitfalls', () => {
    expect(parsePositiveIntParam('1abc')).toBeNull();
    expect(parsePositiveIntParam('0')).toBeNull();
    expect(parsePositiveIntParam('-1')).toBeNull();
    expect(parsePositiveIntParam('')).toBeNull();
    expect(parsePositiveIntParam(undefined)).toBeNull();
  });
});

describe('parseDateOnlyString', () => {
  it('parses YYYY-MM-DD', () => {
    const d = parseDateOnlyString('2026-04-16');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(16);
  });

  it('rejects invalid strings', () => {
    expect(parseDateOnlyString('04-16-2026')).toBeNull();
    expect(parseDateOnlyString('')).toBeNull();
  });
});

describe('parseOptionalDueDateField', () => {
  it('treats null, undefined, empty as clear', () => {
    expect(parseOptionalDueDateField(null)).toEqual({ ok: true, date: null });
    expect(parseOptionalDueDateField(undefined)).toEqual({ ok: true, date: null });
    expect(parseOptionalDueDateField('')).toEqual({ ok: true, date: null });
  });

  it('rejects non-string', () => {
    const r = parseOptionalDueDateField(123);
    expect(r.ok).toBe(false);
  });
});

describe('parseDependencyIds', () => {
  it('defaults missing to empty array', () => {
    expect(parseDependencyIds(undefined)).toEqual({ ok: true, ids: [] });
    expect(parseDependencyIds(null)).toEqual({ ok: true, ids: [] });
  });

  it('rejects non-array', () => {
    const r = parseDependencyIds('oops');
    expect(r.ok).toBe(false);
  });

  it('accepts numeric array', () => {
    expect(parseDependencyIds([1, 2])).toEqual({ ok: true, ids: [1, 2] });
  });
});

describe('parseCreateTodoBody', () => {
  it('requires non-empty title', () => {
    const r = parseCreateTodoBody({ title: '  ' });
    expect(r.ok).toBe(false);
  });

  it('parses valid create payload', () => {
    const r = parseCreateTodoBody({
      title: ' Hello ',
      dueDate: '2026-04-20',
      dependencyIds: [1],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.title).toBe('Hello');
      expect(r.dueDate).not.toBeNull();
      expect(r.dependencyIds).toEqual([1]);
    }
  });
});

describe('parsePositiveIntField', () => {
  it('reads dependencyId', () => {
    expect(parsePositiveIntField({ dependencyId: 2 }, 'dependencyId')).toEqual({ ok: true, id: 2 });
  });

  it('rejects invalid', () => {
    const r = parsePositiveIntField({ dependencyId: 'x' }, 'dependencyId');
    expect(r.ok).toBe(false);
  });
});
