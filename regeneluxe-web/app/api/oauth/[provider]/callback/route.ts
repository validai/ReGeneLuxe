import { NextResponse } from "next/server";
import { getConnector, normalizeProviderId } from "../../../../../server/connectors/registry.js";
import { consumeOAuthState, friendlyOAuthError, peekOAuthState } from "../../../../../server/connectors/oauth/state.js";
import { isConnectionSessionId } from "../../../../../src/data/connectionFlow.js";
import { recordConnectionCallback } from "../../../../../server/connectors/accountConnection.js";
import { initDb, get, upsert, COLLECTIONS } from "../../../../../server/db/index.js";
import { nowIso } from "../../../../../src/data/ids.js";
import { syncConnectedAccount } from "../../../../../server/connectors/syncAccount.js";
import { requireOperator } from "../../../../../server/auth/workspaceSession.js";
import { completeGmailAuth, gmailSettingsRedirect } from "../../../../../server/connectors/gmailConnection.js";
import { completeYoutubeAuth } from "../../../../../server/connectors/youtubeConnection.js";
import { safeReturnTo } from "../../../../../server/auth/apiGuard.js";
import { publicAppOrigin } from "../../../../../server/auth/origin.js";
import { recordBelongsToWorkspace } from "../../../../../server/auth/tenantScope.js";

export const dynamic = "force-dynamic";

function redirectTo(path: string, params: Record<string, string> = {}) {
  const origin = publicAppOrigin();
  const url = new URL(safeReturnTo(path, "/accounts"), origin);
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
    const peeked = peekOAuthState(state);
    if (!(peeked.ok && isConnectionSessionId(peeked.accountId))) {
    const authz = await requireOperator();
    const result = await completeYoutubeAuth({
      code,
      state,
      error,
      errorDescription,
      operator: authz.ok ? authz.operator : null,
    });
    return NextResponse.redirect(result.redirectTo || `${publicAppOrigin()}/settings?youtube=error`);
    }
  }

  try {
    await initDb();
    const authz = await requireOperator();
    const stateResult = consumeOAuthState(state);
    if (!stateResult.ok) {
      return redirectTo("/accounts", {
        connect: "error",
        message: stateResult.error || friendlyOAuthError("expired_state", provider),
      });
    }
    if (stateResult.operatorId && authz.ok && stateResult.operatorId !== authz.operator.id) {
      return redirectTo("/accounts", {
        connect: "error",
        message: "This connection belongs to a different ReGeneLuxe account.",
      });
    }
    if (!authz.ok) {
      return redirectTo("/signin");
    }

    if (isConnectionSessionId(stateResult.accountId)) {
      const connector = getConnector(provider);
      const cancelled = error === "access_denied";
      const result = cancelled || error
        ? { ok: false, error: friendlyOAuthError(error || "access_denied", connector.displayName || provider) }
        : await connector.completeAuth({
          code,
          state,
          stateMeta: stateResult,
          error,
          errorDescription,
        });
      const recorded = await recordConnectionCallback({
        provider,
        sessionId: stateResult.accountId,
        operatorId: authz.operator.id,
        workspaceId: authz.workspace?.id || authz.activeProfile?.id || stateResult.managedProfileId || null,
        result,
        cancelled,
      });
      if (!recorded.ok) {
        return redirectTo("/accounts", {
          connect: "failed",
          message: recorded.failure || "unavailable",
        });
      }
      return redirectTo("/accounts", {
        connect: "select",
        session: stateResult.accountId,
      });
    }

    const account = await get(COLLECTIONS.accounts, stateResult.accountId);
    if (!account || !recordBelongsToWorkspace(account, authz)) {
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
        message: friendlyOAuthError("invalid_grant", connector.displayName || provider),
      });
    }

    const profile = result.profile || {};
    const connectionState = result.connectionState || "CONNECTED";
    const nextAccount = {
      ...account,
      displayName: profile.displayName || account.displayName,
      handle: profile.handle || account.handle,
      profileUrl: profile.profileUrl || account.profileUrl,
      providerAccountId: connectionState === "CONNECTED" ? (profile.providerAccountId || account.providerAccountId || "") : "",
      pageId: profile.pageId || account.pageId || "",
      pageName: profile.pageName || account.pageName || "",
      pendingDestinations: result.pendingDestinations || profile.pendingDestinations || [],
      connectionState,
      connectionMethod: "OAUTH",
      lastErrorSummary: result.error || "",
      updatedAt: nowIso(),
    };
    if (connectionState === "CONNECTED") {
      nextAccount.lastSync = nowIso();
      nextAccount.lastSuccessfulSync = nowIso();
      nextAccount.lastVerifiedAt = nowIso();
    }
    delete nextAccount.accessToken;
    delete nextAccount.refreshToken;
    delete nextAccount.token;
    delete nextAccount.clientSecret;
    delete nextAccount.raw;
    await upsert(COLLECTIONS.accounts, nextAccount);

    if (connectionState === "CONNECTED") {
      try {
        await syncConnectedAccount(nextAccount);
      } catch {
        // ignore
      }
    }

    return redirectTo(stateResult.returnTo || "/accounts", {
      connect: "success",
      provider,
      accountId: account.id,
    });
  } catch {
    return redirectTo("/accounts", {
      connect: "error",
      message: "Connection failed",
    });
  }
}
