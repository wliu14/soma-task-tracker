/**
 * Shared request parsing for API routes (strict integers, date-only strings, JSON).
 */

export type JsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export async function parseJsonBody(request: Request): Promise<JsonParseResult> {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
}

/** Route param or path segment: strict positive integer (rejects parseInt-style partial matches). */
export function parsePositiveIntParam(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** YYYY-MM-DD in local calendar, midnight local. */
export function parseDateOnlyString(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export type OptionalDueDateResult =
  | { ok: true; date: Date | null }
  | { ok: false; error: string };

/** null | undefined | '' => clear / no date; string must be valid YYYY-MM-DD. */
export function parseOptionalDueDateField(value: unknown): OptionalDueDateResult {
  if (value === null || value === undefined || value === '') {
    return { ok: true, date: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Invalid due date' };
  }
  const date = parseDateOnlyString(value);
  if (!date) {
    return { ok: false, error: 'Invalid due date' };
  }
  return { ok: true, date };
}

export type DependencyIdsResult =
  | { ok: true; ids: number[] }
  | { ok: false; error: string };

export function parseDependencyIds(value: unknown): DependencyIdsResult {
  if (value === undefined || value === null) {
    return { ok: true, ids: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: 'dependencyIds must be an array' };
  }
  const ids: number[] = [];
  for (const item of value) {
    const n = typeof item === 'number' && Number.isInteger(item) ? item : Number(item);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, error: 'Each dependency id must be a positive integer' };
    }
    ids.push(n);
  }
  return { ok: true, ids };
}

export type CreateTodoBodyResult =
  | {
      ok: true;
      title: string;
      dueDate: Date | null;
      dependencyIds: number[];
    }
  | { ok: false; error: string };

export function parseCreateTodoBody(data: unknown): CreateTodoBodyResult {
  if (data === null || typeof data !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  const o = data as Record<string, unknown>;
  const titleRaw = o.title;
  if (typeof titleRaw !== 'string' || titleRaw.trim() === '') {
    return { ok: false, error: 'Title is required' };
  }
  const dueParsed = parseOptionalDueDateField(o.dueDate);
  if (!dueParsed.ok) {
    return { ok: false, error: dueParsed.error };
  }
  const depParsed = parseDependencyIds(o.dependencyIds);
  if (!depParsed.ok) {
    return { ok: false, error: depParsed.error };
  }
  return {
    ok: true,
    title: titleRaw.trim(),
    dueDate: dueParsed.date,
    dependencyIds: depParsed.ids,
  };
}

export type PositiveIntResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

/** dependencyId from JSON body: must be a positive integer. */
export function parsePositiveIntField(body: unknown, key: string): PositiveIntResult {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  const raw = (body as Record<string, unknown>)[key];
  const n = typeof raw === 'number' && Number.isInteger(raw) ? raw : Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, error: key === 'dependencyId' ? 'Invalid dependency ID' : 'Invalid id' };
  }
  return { ok: true, id: n };
}
