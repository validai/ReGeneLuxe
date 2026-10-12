import { isConnectionSessionId } from "../../src/data/connectionFlow.js";
import { initDb, list, COLLECTIONS } from "../db/index.js";
import { readSecrets } from "../secrets.js";
import { clearAccountTokens, listProviderCredentialKeys } from "./providers.js";

function sessionClass(session, now) {
  if (!session) return "orphan";
  const expiresAt = Date.parse(session.expiresAt || "");
  if (Number.isFinite(expiresAt) && expiresAt <= now) return "expired";
  if (session.status === "cancelled" || session.status === "failed" || session.status === "expired") return "expired";
  return "active";
}

/**
 * Classify one vault key. Only orphaned connection-session credentials are removable.
 * Live accounts, Gmail, active sessions, and anything ambiguous stay.
 */
export function classifyVaultCredential({ provider, accountId, session, liveAccountIds, now = Date.now() }) {
  if (provider === "gmail") return { category: "gmail", removable: false };
  if (liveAccountIds?.has(accountId)) {
    return { category: isConnectionSessionId(accountId) ? "ambiguous" : "live_account", removable: false };
  }
  if (!isConnectionSessionId(accountId)) return { category: "unknown", removable: false };
  const kind = sessionClass(session, now);
  if (kind === "active") return { category: "active_session", removable: false };
  if (kind === "expired") return { category: "expired_session", removable: true };
  return { category: "orphan_session", removable: true };
}

/**
 * Delete orphaned connection-session vault keys, and expired or cancelled session keys past their TTL.
 * Live account credentials, Gmail credentials, and active session credentials stay.
 * @param {{ now?: number }} [options]
 */
export async function cleanupOrphanSessionCredentials(options = {}) {
  const now = options.now ?? Date.now();
  await initDb();
  const accounts = await list(COLLECTIONS.accounts);
  const liveAccountIds = new Set((accounts || []).map((row) => row?.id).filter(Boolean));
  const sessions = readSecrets().connectionSessions || {};
  const removed = [];
  const retained = [];
  for (const key of listProviderCredentialKeys()) {
    const splitAt = key.indexOf("::");
    if (splitAt < 1) {
      retained.push({ key, category: "unknown" });
      continue;
    }
    const provider = key.slice(0, splitAt);
    const accountId = key.slice(splitAt + 2);
    const finding = classifyVaultCredential({
      provider,
      accountId,
      session: sessions[accountId] || null,
      liveAccountIds,
      now,
    });
    if (!finding.removable) {
      retained.push({ key, category: finding.category });
      continue;
    }
    clearAccountTokens(provider, accountId);
    removed.push({ key, category: finding.category });
  }
  return { removed, retained };
}
