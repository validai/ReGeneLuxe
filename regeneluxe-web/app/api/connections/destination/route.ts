import { initDb, get, upsert, COLLECTIONS } from "../../../../server/db/index.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";
import { recordBelongsToWorkspace } from "../../../../server/auth/tenantScope.js";
import { getAccountTokens, setAccountTokens } from "../../../../server/secrets/providers.js";
import { normalizeProviderId } from "../../../../server/connectors/registry.js";
import { selectionFromVault } from "../../../../server/connectors/providers/metaGraph.js";
import { nowIso } from "../../../../src/data/ids.js";
import { SOCIAL_CONNECTION_STATES } from "../../../../src/data/statusContracts.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  await initDb();
  const body = await request.json().catch(() => ({}));
  const account = await get(COLLECTIONS.accounts, body.accountId);
  if (!account || !recordBelongsToWorkspace(account, authz)) {
    return jsonPrivate({ ok: false, error: "Account not found" }, 404);
  }
  const provider = normalizeProviderId(account.platform);
  if (provider !== "instagram" && provider !== "facebook") {
    return jsonPrivate({ ok: false, error: "Destination selection is for Instagram and Facebook Page." }, 400);
  }
  const tokens = getAccountTokens(provider, account.id);
  const selected = selectionFromVault(tokens?.pages || [], {
    surface: provider,
    pageId: body.pageId,
    instagramId: body.instagramId || "",
  });
  if (!selected.ok) return jsonPrivate({ ok: false, error: selected.error }, 409);
  setAccountTokens(provider, account.id, {
    ...tokens,
    providerAccountId: selected.providerAccountId,
  });
  const next = {
    ...account,
    providerAccountId: selected.providerAccountId,
    externalDestinationId: selected.externalDestinationId,
    pageId: selected.pageId,
    pageName: selected.pageName,
    displayName: selected.displayName || account.displayName,
    handle: selected.handle || account.handle,
    connectionState: SOCIAL_CONNECTION_STATES.CONNECTED,
    connectionMethod: "OAUTH",
    pendingDestinations: [],
    lastVerifiedAt: nowIso(),
    lastErrorSummary: "",
    updatedAt: nowIso(),
  };
  delete next.accessToken;
  delete next.refreshToken;
  delete next.pageAccessToken;
  await upsert(COLLECTIONS.accounts, next);
  return jsonPrivate({
    ok: true,
    account: {
      id: next.id,
      platform: next.platform,
      connectionState: next.connectionState,
      providerAccountId: next.providerAccountId,
      pageId: next.pageId,
      pageName: next.pageName,
      handle: next.handle,
    },
  });
}
