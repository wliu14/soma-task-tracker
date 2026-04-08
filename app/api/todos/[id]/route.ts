import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/response';
import { parseJsonBody, parseOptionalDueDateField, parsePositiveIntParam } from '@/lib/api/validation';
import {
  validateDueDateAgainstDependencies,
  validateDueDateAgainstDependents,
} from '@/lib/domain/todoRules';

interface Params {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const id = parsePositiveIntParam(params.id);
  if (id === null) {
    return jsonError('Invalid ID', 400);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  if (parsed.data === null || typeof parsed.data !== 'object') {
    return jsonError('Invalid request body', 400);
  }

  const dueDateRaw = (parsed.data as Record<string, unknown>).dueDate;
  const dueParsed = parseOptionalDueDateField(dueDateRaw);
  if (!dueParsed.ok) {
    return jsonError(dueParsed.error, 400);
  }
  const newDueDate = dueParsed.date;

  try {
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
      return jsonError('Todo not found', 404);
    }

    if (newDueDate) {
      const depsWithDue = todo.dependsOn.map((d) => d.dependency);
      const depError = validateDueDateAgainstDependencies(
        newDueDate,
        depsWithDue.map((d) => ({ title: d.title, dueDate: d.dueDate }))
      );
      if (depError) {
        return jsonError(depError, 400);
      }

      const dependentsWithDue = todo.dependedOnBy.map((d) => d.dependent);
      const depByError = validateDueDateAgainstDependents(
        newDueDate,
        dependentsWithDue.map((d) => ({ title: d.title, dueDate: d.dueDate }))
      );
      if (depByError) {
        return jsonError(depByError, 400);
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
    return jsonError('Error updating todo', 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const id = parsePositiveIntParam(params.id);
  if (id === null) {
    return jsonError('Invalid ID', 400);
  }

  try {
    await prisma.todo.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch {
    return jsonError('Error deleting todo', 500);
  }
}
