import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

function parseDateOnlyToLocalMidnight(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function PATCH(request: Request, { params }: Params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const dueDateRaw = (body as any)?.dueDate ?? null;
    const newDueDate = dueDateRaw ? parseDateOnlyToLocalMidnight(dueDateRaw) : null;
    if (dueDateRaw && !newDueDate) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    // Fetch this todo with its dependencies and dependents
    const todo = await prisma.todo.findUnique({
      where: { id },
      include: {
        dependsOn: {
          include: { dependency: true },
        },
        dependedOnBy: {
          include: { dependent: true },
        },
      },
    });

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // If setting a due date, enforce ordering with dependencies:
    // newDueDate must be on or after all dependency due dates.
    if (newDueDate) {
      const depsWithDue = todo.dependsOn
        .map(d => d.dependency)
        .filter(d => d.dueDate !== null);
      if (depsWithDue.length > 0) {
        const latestDep = depsWithDue.reduce((latest, current) =>
          latest.dueDate! > current.dueDate! ? latest : current
        );
        if (latestDep.dueDate! > newDueDate) {
          const latestDueStr = latestDep.dueDate!.toLocaleDateString();
          return NextResponse.json(
            {
              error: `Due date must be on or after all dependency due dates. Latest dependency: "${latestDep.title}" due ${latestDueStr}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Also enforce ordering with dependents:
    // Each dependent's due date (if set) must be on or after this task's due date.
    if (newDueDate) {
      const dependentsWithDue = todo.dependedOnBy
        .map(d => d.dependent)
        .filter(d => d.dueDate !== null);
      if (dependentsWithDue.length > 0) {
        const violating = dependentsWithDue.find(d => d.dueDate! < newDueDate);
        if (violating) {
          const vDueStr = violating.dueDate!.toLocaleDateString();
          return NextResponse.json(
            {
              error: `Cannot move this task's due date later than a task that depends on it. "${violating.title}" is due on ${vDueStr}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.todo.update({
      where: { id },
      data: {
        dueDate: newDueDate,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating todo:', error);
    return NextResponse.json({ error: 'Error updating todo' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await prisma.todo.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}
