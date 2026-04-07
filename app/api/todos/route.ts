import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: {
        dependsOn: {
          include: {
            dependency: true,
          },
        },
        dependedOnBy: {
          include: {
            dependent: true,
          },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching todos' }, { status: 500 });
  }
}

async function fetchImageUrl(query: string): Promise<string | null> {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey || apiKey === 'your_pexels_api_key_here') {
      return null;
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const photo = (data as any).photos?.[0];
    return photo?.src?.medium || null;
  } catch (error) {
    console.error('Failed to fetch image from Pexels:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { title, dueDate, dependencyIds } = await request.json();
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const dueDateValue = dueDate ? parseDateOnlyToLocalMidnight(dueDate) : null;
    if (dueDate && !dueDateValue) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    // If a due date and dependencies are provided, ensure the new task's due date
    // is not earlier than any of its dependencies' due dates.
    if (dueDateValue && Array.isArray(dependencyIds) && dependencyIds.length > 0) {
      const deps = await prisma.todo.findMany({
        where: { id: { in: dependencyIds } },
        select: { id: true, title: true, dueDate: true },
      });

      const depsWithDue = deps.filter(d => d.dueDate !== null);
      if (depsWithDue.length > 0) {
        const latestDep = depsWithDue.reduce((latest, current) =>
          latest.dueDate! > current.dueDate! ? latest : current
        );

        if (latestDep.dueDate! > dueDateValue) {
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

    const imageUrl = await fetchImageUrl(title);

    const todo = await prisma.todo.create({
      data: {
        title,
        dueDate: dueDateValue,
        imageUrl,
        dependsOn: dependencyIds && dependencyIds.length > 0 ? {
          create: dependencyIds.map((depId: number) => ({
            dependencyId: depId,
          })),
        } : undefined,
      },
      include: {
        dependsOn: {
          include: {
            dependency: true,
          },
        },
        dependedOnBy: {
          include: {
            dependent: true,
          },
        },
      },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('Error creating todo:', error);
    return NextResponse.json({ error: 'Error creating todo' }, { status: 500 });
  }
}