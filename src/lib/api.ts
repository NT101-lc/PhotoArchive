import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "./auth";
import { BadRequestError, NotFoundError } from "./mutations";
import { StorageNotConfiguredError } from "./storage";

// Helper cho route handler: đọc JSON, đổi lỗi thành response có mã HTTP rõ ràng.

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function errorResponse(err: unknown) {
  if (err instanceof z.ZodError) {
    return json({ error: "Invalid input", issues: z.flattenError(err).fieldErrors }, { status: 400 });
  }
  if (err instanceof BadRequestError) return json({ error: err.message }, { status: 400 });
  if (err instanceof UnauthorizedError) return json({ error: err.message }, { status: 401 });
  if (err instanceof ForbiddenError) return json({ error: err.message }, { status: 403 });
  if (err instanceof NotFoundError) return json({ error: err.message }, { status: 404 });
  if (err instanceof StorageNotConfiguredError) return json({ error: err.message }, { status: 503 });
  console.error(err);
  return json({ error: "Internal server error" }, { status: 500 });
}

/** Bọc handler để mọi lỗi đều thành JSON. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
