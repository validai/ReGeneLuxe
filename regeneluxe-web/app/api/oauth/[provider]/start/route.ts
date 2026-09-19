import { NextResponse } from "next/server";
import { getConnector, normalizeProviderId, listProviderDefinitions } from "../../../../../server/connectors/registry.js";
import { initDb, get, upsert, COLLECTIONS } from "../../../../../server/db/index.js";
import { nowIso } from "../../../../../src/data/ids.js";
import { requireOperator } from "../../../../../server/auth/workspaceSession.js";
import { startGmailAuth } from "../../../../../server/connectors/gmailConnection.js";
import { startYoutubeAuth } from "../../../../../server/connectors/youtubeConnection.js";

export const dynamic = "force-dynamic";

function redirectTo(path: string) {
  const origin = process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174";
  return NextResponse.redirect(new URL(path, origin));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (normalizeProviderId(provider) === "gmail") {
    const authz = await requireOperator();
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
      return NextResponse.redirect(started.redirectTo || `${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/settings?gmail=error`);
    }
    return NextResponse.redirect(started.authUrl);
  }
  if (normalizeProviderId(provider) === "youtube") {
    const authz = await requireOperator();
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
      return NextResponse.redirect(started.redirectTo || `${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/settings?youtube=error`);
    }
    return NextResponse.redirect(started.authUrl);
  }
  const connector = getConnector(provider);
  return NextResponse.json({
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
  try {
    await initDb();
    const { provider } = await context.params;
    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId;
    if (!accountId) {
      return NextResponse.json({ ok: false, error: "accountId required" }, { status: 400 });
    }

    let account = await get(COLLECTIONS.accounts, accountId);
    // Client may still be dual-writing — accept a safe account snapshot (no tokens).
    if (!account && body.account && typeof body.account === "object") {
      const safe = { ...body.account };
      delete safe.accessToken;
      delete safe.refreshToken;
      delete safe.token;
      delete safe.apiKey;
      delete safe.clientSecret;
      account = {
        ...safe,
        id: accountId,
        updatedAt: nowIso(),
      };
      await upsert(COLLECTIONS.accounts, account);
    }
    if (!account) {
      return NextResponse.json({ ok: false, error: "Account not found. Create the account first." }, { status: 404 });
    }

    const connector = getConnector(provider || account.platform);
    const readiness = connector.resolveReadiness?.() || connector.readiness;

    await upsert(COLLECTIONS.accounts, {
      ...account,
      connectionState: readiness === "SETUP_REQUIRED" ? "SETUP_REQUIRED" : "CONNECTING",
      connectionMethod: "OAUTH",
      lastErrorSummary: "",
      updatedAt: nowIso(),
    });

    let loginHint = "";
    const requestedProvider = normalizeProviderId(provider || account.platform);
    if (requestedProvider !== "gmail" && requestedProvider !== "youtube") {
      try {
        const authz = await requireOperator();
        if (authz.ok) {
          loginHint = authz.activeProfile?.googleAccountEmail || authz.operator?.email || "";
        }
      } catch {
        loginHint = "";
      }
    }
    const result = await connector.beginAuth({
      accountId,
      returnTo: body.returnTo || "/accounts",
      loginHint,
    });

    if (!result.ok) {
      await upsert(COLLECTIONS.accounts, {
        ...account,
        connectionState: result.readiness === "SETUP_REQUIRED" ? "SETUP_REQUIRED" : "ERROR",
        lastErrorSummary: result.message || result.reason || "Connect failed",
        updatedAt: nowIso(),
      });
      return NextResponse.json({
        ok: false,
        ...result,
      }, { status: result.readiness === "SETUP_REQUIRED" ? 503 : 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
