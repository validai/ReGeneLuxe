#!/usr/bin/env node
/**
 * Local test-client certification for External Agent Bridge pairing UX/transport truth.
 * Exercises: credential → handshake → connected → context → proposal → revoke (×N).
 * Does not print pairing credentials. Does not create remote tunnels.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-e2e-ext-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-e2e-ext-key-")), "key");
process.env.RL_DB_MODE = "memory";
process.env.EXTERNAL_AGENT_BRIDGE_ENABLED = "1";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, resetDbForTests } = await import("../server/db/index.js");
const {
  beginHandshake,
  cancelOperatorPairing,
  getBridgeStatus,
  readContext,
  revokeOperatorSession,
  startOperatorPairing,
  submitProposal,
} = await import("../server/externalAgent/bridge.js");
const { ROLE_DEFAULT_CAPABILITIES } = await import("../server/externalAgent/roles.js");
const { PROTOCOL_VERSION } = await import("../server/externalAgent/capabilities.js");

const WORKSPACE = "prf_e2e_pairing";
const ROUNDS = 3;

function request() {
  return new Request("http://127.0.0.1:5174/api/external-agent/handshake", {
    method: "POST",
    headers: {
      host: "127.0.0.1:5174",
      origin: "http://localhost:5174",
    },
  });
}

function sessionRequest(token) {
  return new Request("http://127.0.0.1:5174/api/external-agent/context", {
    method: "GET",
    headers: {
      host: "127.0.0.1:5174",
      origin: "http://localhost:5174",
      "x-regeneluxe-agent-session": token,
    },
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function round(n) {
  const remote = startOperatorPairing({
    operatorId: "op_e2e",
    workspaceId: WORKSPACE,
    workspaceName: "E2E TEST",
    agentKey: "mr_post",
    connectionMode: "REMOTE_AGENT",
  });
  assert(remote.ok === false, `round ${n}: remote should fail`);
  assert(remote.code === "REMOTE_TRANSPORT_REQUIRED", `round ${n}: remote code`);
  assert(!remote.pairingCredential, `round ${n}: remote must not emit credential`);

  const unused = startOperatorPairing({
    operatorId: "op_e2e",
    workspaceId: WORKSPACE,
    workspaceName: "E2E TEST",
    agentKey: "mr_post",
    connectionMode: "LOCAL_TEST_CLIENT",
  });
  assert(unused.ok === true, `round ${n}: local pairing`);
  assert(getBridgeStatus(WORKSPACE).state === "WAITING_FOR_AGENT", `round ${n}: waiting`);
  const cancelled = cancelOperatorPairing({ workspaceId: WORKSPACE });
  assert(cancelled.ok === true, `round ${n}: cancel unused`);
  assert(getBridgeStatus(WORKSPACE).state === "READY", `round ${n}: ready after cancel`);

  const created = startOperatorPairing({
    operatorId: "op_e2e",
    workspaceId: WORKSPACE,
    workspaceName: "E2E TEST",
    agentKey: "mr_post",
    connectionMode: "LOCAL_TEST_CLIENT",
  });
  assert(created.ok === true, `round ${n}: create`);
  const credential = created.pairingCredential;
  assert(typeof credential === "string" && credential.startsWith("rlp_"), `round ${n}: credential shape`);

  const wrong = beginHandshake(request(), {
    agentType: "mr_entrepreneur",
    displayName: "MR ENTREPRENEUR",
    instanceId: `wrong-${n}`,
    agentRole: "CAMPAIGN_STRATEGIST",
    protocolVersion: PROTOCOL_VERSION,
    requestedCapabilities: ["READ_PRODUCT_CONTEXT", "SUBMIT_PROPOSAL"],
    pairingCredential: credential,
  });
  assert(wrong.ok === false && wrong.code === "WRONG_AGENT", `round ${n}: wrong agent`);

  const opened = beginHandshake(request(), {
    agentType: "mr_post",
    displayName: "MR POST",
    instanceId: `mr-post-e2e-${n}`,
    agentRole: "CONTENT_OPERATOR",
    protocolVersion: PROTOCOL_VERSION,
    requestedCapabilities: ROLE_DEFAULT_CAPABILITIES.CONTENT_OPERATOR,
    pairingCredential: credential,
  });
  assert(opened.ok === true, `round ${n}: handshake`);
  assert(getBridgeStatus(WORKSPACE).state === "CONNECTED", `round ${n}: connected`);
  assert(
    getBridgeStatus(WORKSPACE).roster.find((row) => row.key === "mr_post")?.status === "CONNECTED",
    `round ${n}: roster`,
  );

  const replay = beginHandshake(request(), {
    agentType: "mr_post",
    displayName: "MR POST",
    instanceId: `mr-post-e2e-replay-${n}`,
    agentRole: "CONTENT_OPERATOR",
    protocolVersion: PROTOCOL_VERSION,
    requestedCapabilities: ROLE_DEFAULT_CAPABILITIES.CONTENT_OPERATOR,
    pairingCredential: credential,
  });
  assert(replay.ok === false, `round ${n}: replay denied`);

  const ctx = await readContext(sessionRequest(opened.sessionToken));
  assert(ctx.ok === true, `round ${n}: context`);

  const proposal = submitProposal(sessionRequest(opened.sessionToken), {
    title: `E2E proposal ${n}`,
    recommendation: "Keep TEST workspace only.",
    summary: "Certification proposal",
  });
  assert(proposal.ok === true, `round ${n}: proposal`);

  const revoked = revokeOperatorSession({ workspaceId: WORKSPACE });
  assert(revoked.ok === true, `round ${n}: revoke`);
  assert(getBridgeStatus(WORKSPACE).state === "READY", `round ${n}: ready after revoke`);
  return { round: n, ok: true };
}

await resetDbForTests();
await initDb();

const results = [];
for (let i = 1; i <= ROUNDS; i += 1) {
  results.push(await round(i));
}

const status = getBridgeStatus(WORKSPACE);
assert(status.transport.remoteAgentCanConnect === false, "remote cannot connect");
assert(status.transport.localRuntimeOnly === true, "local only");

console.log(JSON.stringify({
  ok: true,
  rounds: results.length,
  remoteAgentCanConnect: false,
  statesVerified: ["READY", "WAITING_FOR_AGENT", "CONNECTED", "REMOTE_TRANSPORT_REQUIRED"],
  results,
}, null, 2));
console.log("REGENELUXE_AGENT_PAIRING_E2E_PASS");
