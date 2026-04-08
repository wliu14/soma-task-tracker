import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/response';
import {
  parseJsonBody,
  parsePositiveIntField,
  parsePositiveIntParam,
} from '@/lib/api/validation';
import { validateNewDependencyDueOrder } from '@/lib/domain/todoRules';

interface Params {
  params: {
    id: string;
  };
}

function buildDependencyAdjacency(
  rows: Array<{ dependentId: number; dependencyId: number }>
): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  for (const row of rows) {
    const list = adj.get(row.dependentId);
    if (list) list.push(row.dependencyId);
    else adj.set(row.dependentId, [row.dependencyId]);
  }
  return adj;
}

/** BFS on edges: task → tasks it depends on (`dependencyId`). One DB read builds `adj`. */
function hasPathInAdjacency(adj: Map<number, number[]>, from: number, to: number): boolean {
  const visited = new Set<number>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const next = adj.get(current);
    if (!next) continue;
    for (const depId of next) {
      queue.push(depId);
    }
  }

  return false;
}

async function loadDependencyAdjacency(): Promise<Map<number, number[]>> {
  const rows = await prisma.todoDependency.findMany({
    select: { dependentId: true, dependencyId: true },
  });
  return buildDependencyAdjacency(rows);
}

export async function GET(_request: Request, { params }: Params) {
  const id = parsePositiveIntParam(params.id);
  if (id === null) {
    return jsonError('Invalid ID', 400);
  }

  try {
    const dependencies = await prisma.todoDependency.findMany({
      where: { dependentId: id },
      include: { dependency: true },
    });
    return NextResponse.json(dependencies);
  } catch {
    return jsonError('Error fetching dependencies', 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  const dependentId = parsePositiveIntParam(params.id);
  if (dependentId === null) {
    return jsonError('Invalid ID', 400);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const depIdParsed = parsePositiveIntField(parsed.data, 'dependencyId');
  if (!depIdParsed.ok) {
    return jsonError(depIdParsed.error, 400);
  }
  const dependencyId = depIdParsed.id;

  if (dependentId === dependencyId) {
    return jsonError('Cannot depend on itself', 400);
  }

  try {
    const adj = await loadDependencyAdjacency();
    const wouldCreateCycle = hasPathInAdjacency(adj, dependencyId, dependentId);
    if (wouldCreateCycle) {
      return jsonError('Adding this dependency would create a circular reference', 400);
    }

    const [dependent, dependency] = await Promise.all([
      prisma.todo.findUnique({
        where: { id: dependentId },
        select: { title: true, dueDate: true },
      }),
      prisma.todo.findUnique({
        where: { id: dependencyId },
        select: { title: true, dueDate: true },
      }),
    ]);

    if (!dependent || !dependency) {
      return jsonError('Todo not found', 404);
    }

    const orderError = validateNewDependencyDueOrder(
      { title: dependent.title, dueDate: dependent.dueDate },
      { title: dependency.title, dueDate: dependency.dueDate }
    );
    if (orderError) {
      return jsonError(orderError, 400);
    }

    const existing = await prisma.todoDependency.findFirst({
      where: {
        dependentId,
        dependencyId,
      },
    });

    if (existing) {
      return jsonError('This dependency already exists', 400);
    }

    const dep = await prisma.todoDependency.create({
      data: {
        dependentId,
        dependencyId,
      },
      include: { dependency: true },
    });

    return NextResponse.json(dep, { status: 201 });
  } catch (error) {
    console.error('Error creating dependency:', error);
    return jsonError('Error creating dependency', 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const dependentId = parsePositiveIntParam(params.id);
  if (dependentId === null) {
    return jsonError('Invalid ID', 400);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const depIdParsed = parsePositiveIntField(parsed.data, 'dependencyId');
  if (!depIdParsed.ok) {
    return jsonError(depIdParsed.error, 400);
  }
  const dependencyId = depIdParsed.id;

  try {
    const result = await prisma.todoDependency.deleteMany({
      where: {
        dependentId,
        dependencyId,
      },
    });

    if (result.count === 0) {
      return jsonError('Dependency not found', 404);
    }

    return NextResponse.json({ message: 'Dependency removed' }, { status: 200 });
  } catch {
    return jsonError('Error removing dependency', 500);
  }
}
