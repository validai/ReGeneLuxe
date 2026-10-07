import { Auth } from "@auth/core";
import { cookies } from "next/headers";
import { authOptions } from "../../../../auth";
import { canonicalRequestUrl, withCanonicalHostHeaders } from "../../../../server/auth/origin.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cookieHeaderHasPkce(cookieHeader: string) {
  return /(?:^|;\s*)(?:__Secure-)?authjs\.pkce\.code_verifier=/.test(cookieHeader);
}

function serializeCookieJar(jar: Awaited<ReturnType<typeof cookies>>) {
  return jar.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function toCanonicalWebRequest(req: Request, extraCookieHeader = "") {
  const url = canonicalRequestUrl(req.url);
  const headers = withCanonicalHostHeaders(req.headers);
  const headerCookie = headers.get("cookie") || "";
  const merged = cookieHeaderHasPkce(headerCookie) ? headerCookie : (extraCookieHeader || headerCookie);
  if (merged) headers.set("cookie", merged);
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    init.body = req.body;
    init.duplex = "half";
  }
  return new Request(url, init as never);
}

/**
 * Next.js NextURL rewrites 127.0.0.1 → localhost on NextRequest.
 * Auth.js then sends Google a different redirect_uri than AUTH_URL.
 * Canonicalize the URL while keeping PKCE cookies visible to Auth.js.
 */
async function handle(req: Request): Promise<Response> {
  let jarCookie = "";
  try {
    jarCookie = serializeCookieJar(await cookies());
  } catch {
    jarCookie = "";
  }
  return Auth(toCanonicalWebRequest(req, jarCookie), authOptions as never) as Promise<Response>;
}

export const GET = handle;
export const POST = handle;
