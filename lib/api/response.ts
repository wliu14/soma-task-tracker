import { NextResponse } from 'next/server';

export type ApiErrorBody = { error: string };

export function jsonError(message: string, status: number): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status });
}
