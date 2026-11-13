/**
 * Durable record of controlled real provider tests (TEST workspace only).
 * Never invents GREEN — only records evidence after a verified write/readback.
 */

import { readSecrets, writeSecrets } from "../secrets.js";
import { normalizeProviderId } from "../connectors/registry.js";

function bucket() {
  const secrets = readSecrets();
  secrets.certification = {
    controlledRealTests: {},
    ...(secrets.certification || {}),
  };
  secrets.certification.controlledRealTests = {
    ...(secrets.certification.controlledRealTests || {}),
  };
  return secrets;
}

function keyFor(workspaceId, provider) {
  return `${String(workspaceId || "").trim()}::${normalizeProviderId(provider)}`;
}

export function listControlledRealTests(workspaceId) {
  const secrets = bucket();
  const rows = Object.values(secrets.certification.controlledRealTests || {});
  return rows
    .filter((row) => !workspaceId || row.workspaceId === workspaceId)
    .map((row) => ({ ...row }));
}

export function controlledRealTestsMap(workspaceId) {
  const map = {};
  for (const row of listControlledRealTests(workspaceId)) {
    if (row.passed) map[normalizeProviderId(row.provider)] = true;
  }
  return map;
}

export function recordControlledRealTest({
  workspaceId,
  provider,
  passed = false,
  providerPostId = "",
  externalUrl = "",
  evidence = {},
  note = "",
} = {}) {
  if (!workspaceId || !provider) {
    return { ok: false, code: "WORKSPACE_PROVIDER_REQUIRED", error: "workspaceId and provider are required." };
  }
  const secrets = bucket();
  const id = keyFor(workspaceId, provider);
  const row = {
    id,
    workspaceId,
    provider: normalizeProviderId(provider),
    passed: Boolean(passed),
    providerPostId: String(providerPostId || "").slice(0, 200),
    externalUrl: String(externalUrl || "").slice(0, 500),
    evidence: evidence && typeof evidence === "object" ? evidence : {},
    note: String(note || "").slice(0, 500),
    recordedAt: new Date().toISOString(),
  };
  secrets.certification.controlledRealTests[id] = row;
  writeSecrets(secrets);
  return { ok: true, test: row };
}

export function clearControlledRealTest(workspaceId, provider) {
  const secrets = bucket();
  const id = keyFor(workspaceId, provider);
  delete secrets.certification.controlledRealTests[id];
  writeSecrets(secrets);
  return { ok: true };
}
