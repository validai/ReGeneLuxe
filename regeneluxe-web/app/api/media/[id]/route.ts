import { NextResponse } from "next/server";
import { requireOperator } from "../../../../server/auth/workspaceSession.js";
import { readLocalMedia } from "../../../../server/media/store.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const { id } = await context.params;
  const media = readLocalMedia(id);
  if (!media) {
    return NextResponse.json({ ok: false, error: "Media not found." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(media.buffer), {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.bytes),
      "Cache-Control": "private, max-age=31536000",
    },
  });
}
