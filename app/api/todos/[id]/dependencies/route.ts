import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

// Helper: Check if there's a path from 'from' to 'to' in the dependency graph
async function hasPath(from: number, to: number): Promise<boolean> {
  const visited = new Set<number>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const dependencies = await prisma.todoDependency.findMany({
      where: { dependentId: current },
      select: { dependencyId: true },
    });

    for (const dep of dependencies) {
      queue.push(dep.dependencyId);
    }
  }

  return false;
}

export async function GET(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const dependencies = await prisma.todoDependency.findMany({
      where: { dependentId: id },
      include: { dependency: true },
    });
    return NextResponse.json(dependencies);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching dependencies' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const dependentId = Number(params.id);
  if (!Number.isInteger(dependentId) || dependentId <= 0) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const dependencyIdRaw = (body as any)?.dependencyId;
    const dependencyId = Number(dependencyIdRaw);

    if (!Number.isInteger(dependencyId) || dependencyId <= 0) {
      return NextResponse.json({ error: 'Invalid dependency ID' }, { status: 400 });
    }

    if (dependentId === dependencyId) {
      return NextResponse.json({ error: 'Cannot depend on itself' }, { status: 400 });
    }

    // Check for circular dependency
    const wouldCreateCycle = await hasPath(dependencyId, dependentId);
    if (wouldCreateCycle) {
      return NextResponse.json(
        { error: 'Adding this dependency would create a circular reference' },
        { status: 400 }
      );
    }

    // Enforce due date ordering:
    // If both tasks have due dates, the dependent's due date must be
    // on or after the dependency's due date.
    const [dependent, dependency] = await Promise.all([
      prisma.todo.findUnique({ where: { id: dependentId }, select: { title: true, dueDate: true } }),
      prisma.todo.findUnique({ where: { id: dependencyId }, select: { title: true, dueDate: true } }),
    ]);

    if (dependent && dependency && dependent.dueDate && dependency.dueDate) {
      if (dependent.dueDate < dependency.dueDate) {
        const depDue = dependency.dueDate.toLocaleDateString();
        const depTitle = dependency.title;
        return NextResponse.json(
          {
            error: `Cannot add dependency: "${depTitle}" is due on ${depDue}, which is later than this task's due date.`,
          },
          { status: 400 }
        );
      }
    }

    // Check if dependency already exists
    const existing = await prisma.todoDependency.findFirst({
      where: {
        dependentId,
        dependencyId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This dependency already exists' },
        { status: 400 }
      );
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
    return NextResponse.json({ error: 'Error creating dependency' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const dependentId = parseInt(params.id);
  if (isNaN(dependentId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const { dependencyId } = await request.json();

    if (!dependencyId || isNaN(parseInt(dependencyId))) {
      return NextResponse.json({ error: 'Invalid dependency ID' }, { status: 400 });
    }

    await prisma.todoDependency.deleteMany({
      where: {
        dependentId,
        dependencyId,
      },
    });

    return NextResponse.json({ message: 'Dependency removed' }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error removing dependency' },
      { status: 500 }
    );
  }
}
