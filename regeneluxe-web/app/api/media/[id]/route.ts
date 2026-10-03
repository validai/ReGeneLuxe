import { NextResponse } from "next/server";
import { requireWorkspaceApi, deniedJson } from "../../../../server/auth/apiGuard.js";
import { readLocalMedia } from "../../../../server/media/store.js";
import { workspaceIdOf } from "../../../../server/auth/tenantScope.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const { id } = await context.params;
  if (String(id || "").includes("..") || String(id).includes("/") || String(id).includes("\\") || String(id).includes("%")) {
    return deniedJson("Media not found.", 404);
  }
  const media = readLocalMedia(id, { workspaceId: workspaceIdOf(authz) });
  if (!media) {
    return deniedJson("Media not found.", 404);
  }
  return new NextResponse(new Uint8Array(media.buffer), {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.bytes),
      "Cache-Control": "private, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
