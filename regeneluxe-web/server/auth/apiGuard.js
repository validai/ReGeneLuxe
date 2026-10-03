import "server-only";
import { NextResponse } from "next/server";
import { requireOperator } from "./workspaceSession.js";
import { isAllowedRequestOrigin, isSafeLocalPath, safeReturnTo } from "./origin.js";
import { stripForbiddenWriteFields } from "./identityLock.js";

const PUBLIC_ERROR = "Request was denied.";

export function publicApiError(error, fallback = PUBLIC_ERROR) {
  const raw = error instanceof Error ? error.message : String(error || fallback);
  if (/please sign in|not approved|database/i.test(raw)) return raw;
  if (/not found|already has a brand workspace|does not match/i.test(raw)) return raw;
  return fallback;
}

export function jsonPrivate(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

export function deniedJson(error, status = 401) {
  return jsonPrivate({ ok: false, error: publicApiError(error) }, status);
}

export { isSafeLocalPath, safeReturnTo, isAllowedRequestOrigin };

export async function requireWorkspaceApi(request, { mutate = false } = {}) {
  if (mutate && request && !isAllowedRequestOrigin(request)) {
    return { ok: false, status: 403, error: "This request must come from ReGeneLuxe." };
  }
  return requireOperator();
}

const buckets = new Map();

export function rateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  if (process.env.RL_DB_MODE === "memory") return { ok: true };
  const now = Date.now();
  const bucket = buckets.get(key) || [];
  const fresh = bucket.filter((stamp) => now - stamp < windowMs);
  if (fresh.length >= limit) {
    return { ok: false, status: 429, error: "Too many requests. Try again shortly." };
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true };
}

export function clientKey(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

export { stripForbiddenWriteFields };
