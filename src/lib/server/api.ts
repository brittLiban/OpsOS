import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiError, ApiErrorCode, ApiSuccess } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, meta?: ApiSuccess<T>["meta"]) {
  return NextResponse.json<ApiSuccess<T>>({ data, meta });
}

export function apiError(status: number, code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json<ApiError>(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

export async function withErrorHandling<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", error.flatten());
    }
    if (error instanceof HttpError) {
      return apiError(error.status, error.code, error.message, error.details);
    }

    return apiError(500, "INTERNAL_ERROR", "Unexpected server error");
  }
}

export async function parseBody<T>(request: Request, schema: { parse: (value: unknown) => T }) {
  const json = await request.json();
  return schema.parse(json);
}

export function parseSearchParams<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
) {
  const url = new URL(request.url);
  return schema.parse(Object.fromEntries(url.searchParams));
}
