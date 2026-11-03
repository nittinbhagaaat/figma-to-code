import { NextResponse } from "next/server";
import { AppError, unauthorized, badRequest } from "@/lib/errors";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/services/auth/session";
import { parse } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const ok = (data, status = 200) => NextResponse.json({ ok: true, data }, { status });
export const fail = (error, status = 400, extra = {}) =>
  NextResponse.json({ ok: false, error: { message: error.message ?? String(error), code: error.code ?? "ERROR", details: error.details } }, { status, ...extra });

/** CSRF defence in depth (on top of SameSite=Lax): mutating requests must come from our origin. */
function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests) — cookies can't be attached cross-site without an Origin
  const host = request.headers.get("host");
  let o; try { o = new URL(origin); } catch { throw new AppError("Bad origin", 403, "CSRF"); }
  if (o.host !== host && o.origin !== env.appUrl) throw new AppError("Cross-origin request blocked", 403, "CSRF");
}

/**
 * Wraps a route handler with: DB connect, same-origin check, authentication, body validation,
 * rate limiting and uniform error responses (no stack traces leak to clients).
 *
 * handler({ request, params, user, body, query, ip })
 */
export function route(options, handler) {
  if (typeof options === "function") { handler = options; options = {}; }
  const { auth = true, schema, querySchema, limit, requireVerified = false } = options;
  return async function (request, ctx = {}) {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) assertSameOrigin(request);
      await connectDB();
      const ip = clientIp(request);
      let user = null;
      if (auth) {
        user = await getCurrentUser();
        if (!user) throw unauthorized();
        if (requireVerified && !user.emailVerified) throw new AppError("Verify your email first", 403, "EMAIL_UNVERIFIED");
      }
      if (limit) await rateLimit(`${limit.key || request.nextUrl.pathname}:${user?.id || ip}`, limit);
      const params = ctx.params ? await ctx.params : {};
      let body;
      if (schema) {
        let raw;
        try { raw = await request.json(); } catch { throw badRequest("Request body must be valid JSON"); }
        body = parse(schema, raw);
      }
      const query = querySchema ? parse(querySchema, Object.fromEntries(request.nextUrl.searchParams)) : Object.fromEntries(request.nextUrl.searchParams);
      const res = await handler({ request, params, user, body, query, ip });
      return res instanceof Response ? res : ok(res ?? { done: true });
    } catch (e) {
      if (e instanceof AppError) {
        const headers = e.retryAfter ? { "Retry-After": String(e.retryAfter) } : undefined;
        return fail(e, e.status, { headers });
      }
      if (e?.name === "CastError" || e?.name === "ValidationError") return fail(badRequest("Invalid data"), 400);
      if (e?.code === 11000) return fail(new AppError("Already exists", 409, "CONFLICT"), 409);
      console.error(`[api] ${request.method} ${request.nextUrl?.pathname}`, e);
      return fail({ message: "Something went wrong", code: "INTERNAL" }, 500);
    }
  };
}
