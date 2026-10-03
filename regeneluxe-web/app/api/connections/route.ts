import { listProviderDefinitions, getConnector, normalizeProviderId } from "../../../server/connectors/registry.js";
import { initDb, get, upsert, COLLECTIONS, enqueueJob, JOB_TYPES } from "../../../server/db/index.js";
import { clearAccountTokens, hasAccountTokens, publicProviderVaultStatus } from "../../../server/secrets/providers.js";
import { syncConnectedAccount } from "../../../server/connectors/syncAccount.js";
import { nowIso } from "../../../src/data/ids.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";
import { recordBelongsToWorkspace } from "../../../server/auth/tenantScope.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    return jsonPrivate({
      ok: true,
      providers: listProviderDefinitions(),
      vault: publicProviderVaultStatus(),
    });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not load connections." }, 500);
  }
}

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const action = body.action || "status";
    const accountId = body.accountId;

    if (action === "status") {
      return jsonPrivate({
        ok: true,
        providers: listProviderDefinitions(),
        vault: publicProviderVaultStatus(),
      });
    }

    if (!accountId) {
      return jsonPrivate({ ok: false, error: "accountId required" }, 400);
    }

    const account = await get(COLLECTIONS.accounts, accountId);
    if (!account || !recordBelongsToWorkspace(account, authz)) {
      return jsonPrivate({ ok: false, error: "Account not found" }, 404);
    }

    const provider = normalizeProviderId(body.provider || account.platform);
    const connector = getConnector(provider);

    if (action === "disconnect") {
      await connector.disconnect?.(account);
      clearAccountTokens(provider, accountId);
      const next = {
        ...account,
        connectionState: account.connectionMethod === "MANUAL" ? "MANUAL_ONLY" : "UNCONNECTED",
        lastErrorSummary: "",
        updatedAt: nowIso(),
      };
      await upsert(COLLECTIONS.accounts, next);
      return jsonPrivate({ ok: true, account: next });
    }

    if (action === "refresh") {
      await enqueueJob({
        type: JOB_TYPES.REFRESH_CONNECTION,
        payload: { accountId },
      });
      const synced = await syncConnectedAccount(account);
      return jsonPrivate({ ...synced, hasToken: hasAccountTokens(provider, accountId) });
    }

    if (action === "sync") {
      const synced = await syncConnectedAccount(account);
      return jsonPrivate(synced);
    }

    return jsonPrivate({ ok: false, error: `Unknown action ${action}` }, 400);
  } catch {
    return jsonPrivate({ ok: false, error: "Could not update connection." }, 500);
  }
}
