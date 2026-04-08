import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/response';
import {
  parseCreateTodoBody,
  parseJsonBody,
} from '@/lib/api/validation';
import { validateDueDateAgainstDependencies } from '@/lib/domain/todoRules';

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
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(todos);
  } catch {
    return jsonError('Error fetching todos', 500);
  }
}

interface PexelsSearchResponse {
  photos?: Array<{ src?: { medium?: string } }>;
}

function pickPexelsPhotoUrl(data: unknown): string | null {
  if (data === null || typeof data !== 'object') return null;
  const photos = (data as PexelsSearchResponse).photos;
  const first = photos?.[0];
  const url = first?.src?.medium;
  return typeof url === 'string' ? url : null;
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

    const data: unknown = await response.json();
    return pickPexelsPhotoUrl(data);
  } catch (error) {
    console.error('Failed to fetch image from Pexels:', error);
    return null;
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const body = parseCreateTodoBody(parsed.data);
  if (!body.ok) {
    return jsonError(body.error, 400);
  }

  const { title, dueDate: dueDateValue, dependencyIds } = body;
  const uniqueDependencyIds = Array.from(new Set(dependencyIds));

  try {
    if (uniqueDependencyIds.length > 0) {
      const deps = await prisma.todo.findMany({
        where: { id: { in: uniqueDependencyIds } },
        select: { id: true, title: true, dueDate: true },
      });

      if (deps.length !== uniqueDependencyIds.length) {
        return jsonError('One or more dependencies do not exist', 400);
      }

      if (dueDateValue) {
        const ruleError = validateDueDateAgainstDependencies(
          dueDateValue,
          deps.map((d) => ({ title: d.title, dueDate: d.dueDate }))
        );
        if (ruleError) {
          return jsonError(ruleError, 400);
        }
      }
    }

    const imageUrl = await fetchImageUrl(title);

    const todo = await prisma.todo.create({
      data: {
        title,
        dueDate: dueDateValue,
        imageUrl,
        dependsOn:
          uniqueDependencyIds.length > 0
            ? {
                create: uniqueDependencyIds.map((depId) => ({
                  dependencyId: depId,
                })),
              }
            : undefined,
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
    return jsonError('Error creating todo', 500);
  }
}
