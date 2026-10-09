import { requireWorkspaceApi, deniedJson, jsonPrivate, rateLimit, clientKey } from "../../../../server/auth/apiGuard.js";
import {
  cancelAccountConnection,
  confirmAccountConnection,
  readPublicConnectionSession,
  startAccountConnection,
} from "../../../../server/connectors/accountConnection.js";
import { CONNECTION_FAILURES } from "../../../../src/data/connectionFlow.js";

export const dynamic = "force-dynamic";

function workspaceOf(authz: {
  operator?: { id?: string };
  workspace?: { id?: string; displayName?: string };
  activeProfile?: { id?: string; displayName?: string };
}) {
  return {
    operatorId: authz.operator?.id || null,
    workspaceId: authz.workspace?.id || authz.activeProfile?.id || null,
    workspaceName: authz.activeProfile?.displayName || authz.workspace?.displayName || "",
  };
}

function failureBody(failure: string | undefined) {
  const known = (failure || "unavailable") as keyof typeof CONNECTION_FAILURES;
  const copy = CONNECTION_FAILURES[known] || CONNECTION_FAILURES.unavailable;
  return { ok: false, failure: failure || "unavailable", title: copy.title, message: copy.body };
}

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const id = new URL(request.url).searchParams.get("id") || "";
  const scope = workspaceOf(authz);
  const result = readPublicConnectionSession(id, scope);
  if (!result.ok) return jsonPrivate(failureBody(result.failure), 404);
  return jsonPrivate({ ok: true, session: result.session });
}

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const limited = rateLimit(`connection-session:${clientKey(request)}:${authz.operator.id}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return deniedJson(limited.error, limited.status);
  const body = await request.json().catch(() => ({}));
  const scope = workspaceOf(authz);
  const action = body.action || "start";

  if (action === "start") {
    const started = await startAccountConnection({
      provider: body.provider,
      ...scope,
    });
    if (!started.ok) return jsonPrivate({ ...failureBody(started.failure), readiness: started.readiness || "" }, started.readiness === "SETUP_REQUIRED" ? 503 : 400);
    return jsonPrivate({ ok: true, authUrl: started.authUrl, session: started.session });
  }

  if (action === "confirm") {
    const confirmed = await confirmAccountConnection({
      sessionId: body.sessionId,
      selectedIds: Array.isArray(body.selectedIds) ? body.selectedIds : [],
      choices: body.choices && typeof body.choices === "object" ? body.choices : {},
      ...scope,
    });
    if (!confirmed.ok) {
      return jsonPrivate({
        ...failureBody(confirmed.failure),
        needsChoice: confirmed.needsChoice || [],
      }, 409);
    }
    return jsonPrivate({
      ok: true,
      created: (confirmed.created || []).map(publicAccount),
      linked: (confirmed.linked || []).map(publicAccount),
    });
  }

  if (action === "cancel") {
    const cancelled = await cancelAccountConnection({ sessionId: body.sessionId, ...scope });
    if (!cancelled.ok) return jsonPrivate(failureBody(cancelled.failure), 403);
    return jsonPrivate({ ok: true });
  }

  return jsonPrivate({ ok: false, error: "Unknown connection action." }, 400);
}

function publicAccount(account: {
  id: string;
  platform: string;
  displayName: string;
  handle: string;
  profileUrl?: string;
  providerAccountId?: string;
  pageId?: string;
  pageName?: string;
  connectionState: string;
  connectionMethod: string;
  lastVerifiedAt?: string;
  managedProfileId?: string | null;
}) {
  return {
    id: account.id,
    platform: account.platform,
    displayName: account.displayName,
    handle: account.handle,
    profileUrl: account.profileUrl || "",
    providerAccountId: account.providerAccountId || "",
    pageId: account.pageId || "",
    pageName: account.pageName || "",
    connectionState: account.connectionState,
    connectionMethod: account.connectionMethod,
    lastVerifiedAt: account.lastVerifiedAt || "",
    managedProfileId: account.managedProfileId || null,
  };
}
