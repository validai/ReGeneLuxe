import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";
import { getMeta, setMeta } from "../../../../server/db/index.js";
import { PUBLISHING_PAUSE_META_KEY } from "../../../../server/marketingDrafts/dispatchPipeline.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await requireWorkspaceApi(request);
  if (!result.ok) return deniedJson(result.error, result.status);
  const raw = await getMeta(PUBLISHING_PAUSE_META_KEY);
  const paused = raw === "1" || raw === "true" || raw === true;
  return jsonPrivate({
    ok: true,
    paused,
    label: paused ? "PAUSED" : "ACTIVE",
    note: paused
      ? "Scheduled provider writes are paused. Drafts, approvals, and connections remain."
      : "Scheduled publishing is active.",
  });
}

export async function POST(request: Request) {
  const result = await requireWorkspaceApi(request, { mutate: true });
  if (!result.ok) return deniedJson(result.error, result.status);
  const body = await request.json().catch(() => ({}));
  const paused = Boolean(body.paused);
  await setMeta(PUBLISHING_PAUSE_META_KEY, paused ? "1" : "0");
  return jsonPrivate({
    ok: true,
    paused,
    label: paused ? "PAUSED" : "ACTIVE",
  });
}
