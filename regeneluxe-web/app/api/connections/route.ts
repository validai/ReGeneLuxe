import { NextResponse } from "next/server";
import { listProviderDefinitions, getConnector, normalizeProviderId } from "../../../server/connectors/registry.js";
import { initDb, get, upsert, COLLECTIONS, enqueueJob, JOB_TYPES } from "../../../server/db/index.js";
import { clearAccountTokens, hasAccountTokens, publicProviderVaultStatus } from "../../../server/secrets/providers.js";
import { syncConnectedAccount } from "../../../server/connectors/syncAccount.js";
import { nowIso } from "../../../src/data/ids.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    return NextResponse.json({
      ok: true,
      providers: listProviderDefinitions(),
      vault: publicProviderVaultStatus(),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const action = body.action || "status";
    const accountId = body.accountId;

    if (action === "status") {
      return NextResponse.json({
        ok: true,
        providers: listProviderDefinitions(),
        vault: publicProviderVaultStatus(),
      });
    }

    if (!accountId) {
      return NextResponse.json({ ok: false, error: "accountId required" }, { status: 400 });
    }

    const account = await get(COLLECTIONS.accounts, accountId);
    if (!account) {
      return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
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
      return NextResponse.json({ ok: true, account: next });
    }

    if (action === "refresh") {
      await enqueueJob({
        type: JOB_TYPES.REFRESH_CONNECTION,
        payload: { accountId },
      });
      const synced = await syncConnectedAccount(account);
      return NextResponse.json({ ...synced, hasToken: hasAccountTokens(provider, accountId) });
    }

    if (action === "sync") {
      const synced = await syncConnectedAccount(account);
      return NextResponse.json(synced);
    }

    return NextResponse.json({ ok: false, error: `Unknown action ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
