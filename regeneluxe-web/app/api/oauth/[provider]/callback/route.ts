import { NextResponse } from "next/server";
import { getConnector, normalizeProviderId } from "../../../../../server/connectors/registry.js";
import { consumeOAuthState, friendlyOAuthError } from "../../../../../server/connectors/oauth/state.js";
import { initDb, get, upsert, COLLECTIONS } from "../../../../../server/db/index.js";
import { nowIso } from "../../../../../src/data/ids.js";
import { syncConnectedAccount } from "../../../../../server/connectors/syncAccount.js";
import { requireOperator } from "../../../../../server/auth/workspaceSession.js";
import { completeGmailAuth, gmailSettingsRedirect } from "../../../../../server/connectors/gmailConnection.js";
import { completeYoutubeAuth } from "../../../../../server/connectors/youtubeConnection.js";

export const dynamic = "force-dynamic";

function redirectTo(path: string, params: Record<string, string> = {}) {
  const origin = process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174";
  const url = new URL(path, origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await context.params;
  const provider = normalizeProviderId(providerParam);
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error") || "";
  const errorDescription = url.searchParams.get("error_description") || "";

  if (provider === "gmail") {
    const authz = await requireOperator();
    const result = await completeGmailAuth({
      code,
      state,
      error,
      errorDescription,
      operator: authz.ok ? authz.operator : null,
    });
    return NextResponse.redirect(result.redirectTo || gmailSettingsRedirect({ gmail: "error" }));
  }

  if (provider === "youtube") {
    const authz = await requireOperator();
    const result = await completeYoutubeAuth({
      code,
      state,
      error,
      errorDescription,
      operator: authz.ok ? authz.operator : null,
    });
    return NextResponse.redirect(result.redirectTo || `${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/settings?youtube=error`);
  }

  try {
    await initDb();
    const stateResult = consumeOAuthState(state);
    if (!stateResult.ok) {
      return redirectTo("/accounts", {
        connect: "error",
        message: stateResult.error || friendlyOAuthError("expired_state", provider),
      });
    }

    const account = await get(COLLECTIONS.accounts, stateResult.accountId);
    if (!account) {
      return redirectTo("/accounts", {
        connect: "error",
        message: "Account missing for this connection.",
      });
    }

    const connector = getConnector(provider);
    const result = await connector.completeAuth({
      code,
      state,
      stateMeta: stateResult,
      error,
      errorDescription,
    });

    if (!result.ok) {
      await upsert(COLLECTIONS.accounts, {
        ...account,
        connectionState: result.connectionState || "ERROR",
        lastErrorSummary: result.error || "Connection failed",
        updatedAt: nowIso(),
      });
      return redirectTo(stateResult.returnTo || "/accounts", {
        connect: "error",
        message: result.error || friendlyOAuthError("invalid_grant", connector.displayName || provider),
      });
    }

    const profile = result.profile || {};
    const nextAccount = {
      ...account,
      ...profile,
      connectionState: "CONNECTED",
      connectionMethod: "OAUTH",
      lastSync: nowIso(),
      lastSuccessfulSync: nowIso(),
      lastErrorSummary: "",
      updatedAt: nowIso(),
    };
    await upsert(COLLECTIONS.accounts, nextAccount);

    // Best-effort initial sync — failures should not undo connection.
    try {
      await syncConnectedAccount(nextAccount);
    } catch {
      // ignore
    }

    return redirectTo(stateResult.returnTo || "/accounts", {
      connect: "success",
      provider,
      accountId: account.id,
    });
  } catch (err) {
    return redirectTo("/accounts", {
      connect: "error",
      message: err instanceof Error ? err.message : "Connection failed",
    });
  }
}
