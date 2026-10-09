import { NextResponse } from "next/server";
import { getConnector, normalizeProviderId, listProviderDefinitions } from "../../../../../server/connectors/registry.js";
import { initDb, get, COLLECTIONS } from "../../../../../server/db/index.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate, rateLimit, clientKey, safeReturnTo } from "../../../../../server/auth/apiGuard.js";
import { recordBelongsToWorkspace } from "../../../../../server/auth/tenantScope.js";
import { publicAppOrigin } from "../../../../../server/auth/origin.js";
import { startGmailAuth } from "../../../../../server/connectors/gmailConnection.js";
import { startYoutubeAuth } from "../../../../../server/connectors/youtubeConnection.js";

export const dynamic = "force-dynamic";

function redirectTo(path: string) {
  const origin = publicAppOrigin();
  return NextResponse.redirect(new URL(safeReturnTo(path, "/settings"), origin));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (normalizeProviderId(provider) === "gmail") {
    const authz = await requireWorkspaceApi(request);
    if (!authz.ok) {
      if (authz.status === 503) return redirectTo("/signin?error=database");
      return redirectTo("/signin");
    }
    const started = await startGmailAuth({
      operator: authz.operator,
      activeProfile: authz.activeProfile,
      returnTo: "/settings",
    });
    if (!started.ok || !started.authUrl) {
      return redirectTo("/settings?gmail=error");
    }
    return NextResponse.redirect(started.authUrl);
  }
  if (normalizeProviderId(provider) === "youtube") {
    const authz = await requireWorkspaceApi(request);
    if (!authz.ok) {
      if (authz.status === 503) return redirectTo("/signin?error=database");
      return redirectTo("/signin");
    }
    const started = await startYoutubeAuth({
      operator: authz.operator,
      activeProfile: authz.activeProfile,
      returnTo: "/settings",
    });
    if (!started.ok || !started.authUrl) {
      return redirectTo("/settings?youtube=error");
    }
    return NextResponse.redirect(started.authUrl);
  }
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const connector = getConnector(provider);
  return jsonPrivate({
    ok: true,
    provider: normalizeProviderId(provider),
    displayName: connector.displayName,
    readiness: connector.resolveReadiness?.() || connector.readiness,
    capabilities: connector.capabilities || [],
    setupInstructions: connector.setupInstructions || "",
    reviewNotes: connector.reviewNotes || "",
    providers: listProviderDefinitions(),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const limited = rateLimit(`oauth-start:${clientKey(request)}:${authz.operator.id}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return deniedJson(limited.error, limited.status);
  try {
    await initDb();
    const { provider } = await context.params;
    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId;
    if (!accountId) {
      return jsonPrivate({ ok: false, error: "accountId required" }, 400);
    }

    const account = await get(COLLECTIONS.accounts, accountId);
    if (!account || !recordBelongsToWorkspace(account, authz)) {
      return jsonPrivate({ ok: false, error: "Account not found. Create the account first." }, 404);
    }

    const connector = getConnector(provider || account.platform);
    const providerId = normalizeProviderId(provider || account.platform);
    const result = await connector.beginAuth({
      accountId,
      returnTo: safeReturnTo(body.returnTo, "/accounts"),
      loginHint: authz.activeProfile?.googleAccountEmail || authz.operator?.email || "",
      operatorId: authz.operator.id,
      managedProfileId: authz.workspace?.id || authz.activeProfile?.id || null,
      includeUpload: providerId === "youtube",
    });

    if (!result.ok) {
      return jsonPrivate({
        ok: false,
        error: "Could not start this connection.",
        readiness: result.readiness,
      }, result.readiness === "SETUP_REQUIRED" ? 503 : 400);
    }

    return jsonPrivate({ ok: true, ...result });
  } catch {
    return jsonPrivate({
      ok: false,
      error: "Could not start this connection.",
    }, 500);
  }
}
