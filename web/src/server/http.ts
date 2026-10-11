// Small helpers for route handlers.
import { connection } from "next/server";
import { z } from "zod";
import { CommandError } from "./commands";
import { getDb, type Db } from "./db";

/** Waits for a real request (the SQLite driver is synchronous, so Next.js would otherwise prerender), then returns the DB. */
export async function requestDb(): Promise<Db> {
  await connection();
  return getDb();
}

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * The simulator, uploads, "Reset demo" and the live-messages switch are for
 * the presenter on the laptop. Requests through the public tunnel are refused.
 */
export function laptopOnly(request: Request): Response | null {
  const h = request.headers;
  const viaTunnel = h.has("cf-connecting-ip") || h.has("cf-ray");
  const host = (h.get("host") ?? "").split(":")[0];
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return !viaTunnel && local ? null : errorResponse("This action is only available on the presenter's laptop.", 403);
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be JSON", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return errorResponse(`${issue?.path.join(".") || "body"}: ${issue?.message ?? "invalid"}`, 400);
  }
  return parsed.data;
}

/** Wraps a handler so CommandErrors become clean JSON errors. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CommandError) return errorResponse(err.message, err.status);
    console.error(err);
    return errorResponse("Something went wrong", 500);
  }
}
