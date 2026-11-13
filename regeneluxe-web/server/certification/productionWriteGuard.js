/**
 * Fail-closed guard for provider writes.
 *
 * Authorization for controlled real testing is TEST-workspace only.
 * DJ Coast production must never receive certification (or accidental) writes.
 */

import { normalizeWorkspacePurpose } from "../../src/data/profileModels.js";

/** Historical DJ Coast production workspace id (docs + live DB). */
export const DJ_COAST_WORKSPACE_ID = "ffaed2b8-ae61-46dd-87f8-77b3d3de3c66";

export function isDjCoastWorkspace(workspace = null) {
  if (!workspace) return false;
  const id = String(workspace.id || "").trim();
  const slug = String(workspace.slug || "").trim().toLowerCase();
  const name = String(workspace.displayName || workspace.name || "").trim().toLowerCase();
  if (id && id === DJ_COAST_WORKSPACE_ID) return true;
  if (slug === "dj-coast") return true;
  if (name === "dj coast") return true;
  return false;
}

export function productionWritesAllowedByEnv(env = process.env) {
  return String(env.REGENELUXE_ALLOW_PRODUCTION_PROVIDER_WRITES || "").trim() === "1";
}

/**
 * Live runtimes require TEST.
 * Vitest / in-memory unit suites waive purpose (DJ Coast remains always blocked).
 */
export function testWorkspaceRequired(env = process.env) {
  if (productionWritesAllowedByEnv(env)) return false;
  if (String(env.RL_DB_MODE || "").trim() === "memory") return false;
  if (String(env.VITEST || "").trim() === "true") return false;
  return true;
}

/**
 * @param {{
 *   workspace?: object|null,
 *   account?: object|null,
 *   dryRun?: boolean,
 *   env?: NodeJS.ProcessEnv,
 * }} [opts]
 */
export function assertProviderWriteAllowed({
  workspace = null,
  account = null,
  dryRun = false,
  env = process.env,
} = {}) {
  if (dryRun) {
    return { ok: true, dryRun: true, providerWrite: false, code: "DRY_RUN" };
  }

  const accountWorkspaceId = String(account?.managedProfileId || account?.workspaceId || "").trim();
  const ws = workspace || (accountWorkspaceId ? { id: accountWorkspaceId } : null);

  if (isDjCoastWorkspace(ws) || accountWorkspaceId === DJ_COAST_WORKSPACE_ID) {
    return {
      ok: false,
      status: 403,
      code: "DJ_COAST_PRODUCTION_WRITE_BLOCKED",
      error: "DJ Coast production provider writes are blocked. Use the alternate-artist TEST workspace only.",
      providerWrite: false,
    };
  }

  const purpose = normalizeWorkspacePurpose(ws?.workspacePurpose);
  if (purpose !== "TEST" && testWorkspaceRequired(env)) {
    return {
      ok: false,
      status: 403,
      code: "TEST_WORKSPACE_REQUIRED",
      error: "Controlled provider writes require a TEST workspace. Set REGENELUXE_ALLOW_PRODUCTION_PROVIDER_WRITES=1 only after TEST certification and explicit promotion.",
      providerWrite: false,
      workspacePurpose: purpose,
    };
  }

  return {
    ok: true,
    dryRun: false,
    providerWrite: true,
    code: "ALLOWED",
    workspacePurpose: purpose,
  };
}
