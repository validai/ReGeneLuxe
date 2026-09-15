import { Auth } from "@auth/core";
import { authOptions } from "../../../../auth";
import { canonicalRequestUrl, withCanonicalHostHeaders } from "../../../../server/auth/origin.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Next.js NextURL rewrites 127.0.0.1 → localhost on NextRequest.
 * Auth.js then sends Google token exchange a different redirect_uri than
 * authorization (AUTH_URL is 127.0.0.1), which Google rejects as
 * redirect_uri_mismatch. Call Auth.js with a standard Request so the
 * canonical origin is preserved.
 */
function toCanonicalWebRequest(req: Request) {
  const url = canonicalRequestUrl(req.url);
  const headers = withCanonicalHostHeaders(req.headers);
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

async function handle(req: Request): Promise<Response> {
  return Auth(toCanonicalWebRequest(req), authOptions as never) as Promise<Response>;
}

export const GET = handle;
export const POST = handle;
