import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-ext-agent-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-ext-agent-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.EXTERNAL_AGENT_BRIDGE_ENABLED;
delete process.env.EXTERNAL_AGENT_BRIDGE_SECRET;

const { initDb, resetDbForTests, upsert, list, COLLECTIONS } = await import("../db/index.js");
const { setAccountTokens } = await import("../secrets/providers.js");
const { isPublicPath } = await import("../auth/publicPaths.js");
const {
  beginHandshake,
  cancelOperatorPairing,
  closeSession,
  denyControlAttempt,
  getBridgeStatus,
  listAgentProposals,
  listOperatorProposals,
  readCapabilities,
  readContext,
  readNorthStar,
  readOperations,
  reviewOperatorProposal,
  revokeOperatorSession,
  startOperatorPairing,
  submitProposal,
} = await import("./bridge.js");
const { NORTH_STAR } = await import("./northStar.js");
const {
  ALLOWED_CAPABILITIES,
  V1_CAPABILITIES,
  DENIED_ACTIONS,
  PROTOCOL_VERSION,
  isDeniedAction,
} = await import("./capabilities.js");
const { summarizeAnalytics, summarizeInbox, scrubValue } = await import("./context.js");
const {
  AUDIT,
  PAIRING_PREFIX,
  SESSION_TTL_MS,
  generatePairingCredential,
  hashToken,
} = await import("./store.js");
const { readSecrets, writeSecrets } = await import("../secrets.js");

const WORKSPACE_A = "prf_workspace_a";
const WORKSPACE_B = "prf_workspace_b";
const ALL_CAPS = [...V1_CAPABILITIES];

function request(headers = {}) {
  return new Request("http://127.0.0.1:5174/api/external-agent/handshake", {
    method: "POST",
    headers: {
      host: "127.0.0.1:5174",
      origin: "http://localhost:5174",
      ...headers,
    },
  });
}

function enableBridge() {
  process.env.EXTERNAL_AGENT_BRIDGE_ENABLED = "1";
}

function agentIdentity(overrides = {}) {
  return {
    agentType: "grokbot",
    displayName: "GrokBot",
    instanceId: "grokbot-instance-1",
    protocolVersion: PROTOCOL_VERSION,
    requestedCapabilities: ALL_CAPS,
    ...overrides,
  };
}

function startPairing(workspaceId = WORKSPACE_A) {
  enableBridge();
  return startOperatorPairing({
    operatorId: "op_test",
    workspaceId,
    workspaceName: "Test Brand",
  });
}

async function openSession(overrides = {}, workspaceId = WORKSPACE_A) {
  const pairing = startPairing(workspaceId);
  expect(pairing.ok).toBe(true);
  return beginHandshake(request(), {
    ...agentIdentity(overrides),
    pairingCredential: pairing.pairingCredential,
  });
}

describe("External Agent Bridge", () => {
  beforeEach(async () => {
    delete process.env.EXTERNAL_AGENT_BRIDGE_ENABLED;
    delete process.env.EXTERNAL_AGENT_BRIDGE_SECRET;
    await resetDbForTests();
    await initDb();
  });

  afterEach(() => {
    delete process.env.EXTERNAL_AGENT_BRIDGE_ENABLED;
    delete process.env.EXTERNAL_AGENT_BRIDGE_SECRET;
  });

  it("stays disabled by default and does not require a standing shared secret", () => {
    const status = getBridgeStatus(WORKSPACE_A);
    expect(status.ok).toBe(true);
    expect(status.enabled).toBe(false);
    expect(status.state).toBe("DISABLED");
    expect(status.code).toBe("BRIDGE_DISABLED");

    process.env.EXTERNAL_AGENT_BRIDGE_ENABLED = "1";
    const ready = getBridgeStatus(WORKSPACE_A);
    expect(ready.enabled).toBe(true);
    expect(ready.state).toBe("READY_FOR_PAIRING");
    expect(ready.code).toBe("READY");
    expect(JSON.stringify(ready)).not.toMatch(/EXTERNAL_AGENT_BRIDGE_SECRET|standing/i);
  });

  it("exposes external-agent routes to Auth.js as public while keeping its own gate", () => {
    expect(isPublicPath("/api/external-agent/handshake")).toBe(true);
    expect(isPublicPath("/api/external-agent/context")).toBe(true);
    expect(isPublicPath("/api/publish")).toBe(false);
  });

  it("lets an operator create a one-time high-entropy pairing credential that is never persisted plaintext", () => {
    const created = startPairing();
    expect(created.ok).toBe(true);
    expect(created.pairingCredential).toMatch(new RegExp(`^${PAIRING_PREFIX}[A-Za-z0-9_-]{40,}$`));
    expect(created.pairingCredential.length).toBeGreaterThanOrEqual(40);
    expect(created.pairing.status).toBe("active");

    const a = generatePairingCredential();
    const b = generatePairingCredential();
    expect(a).not.toBe(b);

    const stored = JSON.stringify(readSecrets().externalAgent);
    expect(stored).not.toContain(created.pairingCredential);
    expect(stored).toContain(hashToken(created.pairingCredential));
    expect(getBridgeStatus(WORKSPACE_A).state).toBe("PAIRING_ACTIVE");
  });

  it("expires and cancels pairings; rejects replay after consume", () => {
    const created = startPairing();
    const cancelled = cancelOperatorPairing({ workspaceId: WORKSPACE_A });
    expect(cancelled.ok).toBe(true);
    expect(cancelled.pairing.status).toBe("cancelled");
    const afterCancel = beginHandshake(request(), {
      ...agentIdentity(),
      pairingCredential: created.pairingCredential,
    });
    expect(afterCancel.ok).toBe(false);

    const again = startPairing();
    const secrets = readSecrets();
    const pairingId = again.pairing.id;
    secrets.externalAgent.pairings[pairingId].expiresAt = new Date(Date.now() - 1000).toISOString();
    writeSecrets(secrets);
    const expired = beginHandshake(request(), {
      ...agentIdentity(),
      pairingCredential: again.pairingCredential,
    });
    expect(expired.ok).toBe(false);
    expect(expired.code).toBe("INVALID_OR_EXPIRED_PAIRING");

    const live = startPairing();
    const first = beginHandshake(request(), {
      ...agentIdentity(),
      pairingCredential: live.pairingCredential,
    });
    expect(first.ok).toBe(true);
    const replay = beginHandshake(request(), {
      ...agentIdentity({ instanceId: "other" }),
      pairingCredential: live.pairingCredential,
    });
    expect(replay.ok).toBe(false);
    expect(replay.code).toBe("INVALID_OR_EXPIRED_PAIRING");
  });

  it("handshakes with pairing credential, returns a session token once, and teaches the North Star", async () => {
    const opened = await openSession();
    expect(opened.ok).toBe(true);
    expect(opened.sessionToken).toMatch(/^eas_tok_/);
    expect(opened.session.role).toBe("trusted_analyst");
    expect(opened.session.workspaceId).toBe(WORKSPACE_A);
    expect(opened.session.agentType).toBe("grokbot");
    expect(opened.session.instanceId).toBe("grokbot-instance-1");
    expect(opened.session.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(opened.session.capabilities).toEqual(expect.arrayContaining(ALL_CAPS));
    expect(Date.parse(opened.session.expiresAt) - Date.parse(opened.session.startedAt)).toBe(SESSION_TTL_MS);
    expect(opened.northStar.statement).toBe(NORTH_STAR.statement);
    expect(opened.northStar.job).toContain("reduce the manual work");
    expect(opened.northStar.coreLoop).toEqual(NORTH_STAR.coreLoop);
    expect(opened.northStar.operatingStatement).toContain("Create once");
    expect(opened.northStar.humanControl).toMatch(/final control/i);
    expect(opened.northStar.marketingTeam.roles.map((row) => row.id)).toEqual([
      "MR_ENTREPRENEUR",
      "GOOD_POST_REVIEWS",
      "REGENELUXE",
      "HUMAN_OPERATOR",
    ]);
    expect(opened.northStar.marketingTeam.note).toMatch(/no role-specific elevated/i);
    expect(opened.capabilities.denied).toEqual(expect.arrayContaining(["PUBLISH", "RUN_SHELL"]));
    expect(JSON.stringify(readSecrets().externalAgent.sessions)).not.toContain(opened.sessionToken);
    expect(JSON.stringify(readSecrets().externalAgent.pairings)).not.toContain(opened.sessionToken);
  });

  it("rejects unknown capabilities and standing-secret style handshakes", () => {
    const created = startPairing();
    const unknown = beginHandshake(request(), {
      ...agentIdentity({ requestedCapabilities: ["READ_PRODUCT_CONTEXT", "EXECUTE_PROPOSAL"] }),
      pairingCredential: created.pairingCredential,
    });
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe("UNKNOWN_CAPABILITY");

    enableBridge();
    const noPairing = beginHandshake(request({
      "x-regeneluxe-agent-secret": "standing-secret-should-not-work",
    }), agentIdentity());
    expect(noPairing.ok).toBe(false);
    expect(noPairing.code).toBe("INVALID_OR_EXPIRED_PAIRING");
  });

  it("enforces local-only requests and rejects cross-site calls", () => {
    const created = startPairing();
    const cross = beginHandshake(new Request("http://127.0.0.1:5174/api/external-agent/handshake", {
      method: "POST",
      headers: {
        host: "127.0.0.1:5174",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    }), {
      ...agentIdentity(),
      pairingCredential: created.pairingCredential,
    });
    expect(cross.ok).toBe(false);
    expect(cross.status).toBe(403);

    const remoteHost = beginHandshake(new Request("http://example.com:5174/api/external-agent/handshake", {
      method: "POST",
      headers: {
        host: "example.com:5174",
        origin: "http://example.com:5174",
      },
    }), {
      ...agentIdentity(),
      pairingCredential: created.pairingCredential,
    });
    expect(remoteHost.ok).toBe(false);
    expect(remoteHost.code).toBe("REQUEST_DENIED");
  });

  it("binds sessions to workspace/instance/protocol and revokes or expires them", async () => {
    const opened = await openSession();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    expect((await readContext(authed)).ok).toBe(true);

    const revoked = revokeOperatorSession({ workspaceId: WORKSPACE_A });
    expect(revoked.ok).toBe(true);
    expect((await readContext(authed)).code).toBe("SESSION_REQUIRED");

    const opened2 = await openSession({ instanceId: "inst-2" });
    const secrets = readSecrets();
    const sessionId = opened2.session.id;
    secrets.externalAgent.sessions[sessionId].expiresAt = new Date(Date.now() - 1000).toISOString();
    writeSecrets(secrets);
    const expired = await readContext(request({ "x-regeneluxe-agent-session": opened2.sessionToken }));
    expect(expired.ok).toBe(false);
    expect(expired.code).toBe("SESSION_REQUIRED");

    const opened3 = await openSession({ instanceId: "inst-3" });
    const mutated = readSecrets();
    mutated.externalAgent.sessions[opened3.session.id].protocolVersion = "999";
    writeSecrets(mutated);
    const badProtocol = await readContext(request({ "x-regeneluxe-agent-session": opened3.sessionToken }));
    expect(badProtocol.code).toBe("PROTOCOL_MISMATCH");
  });

  it("serves sanitized context with North Star, analytics nulls, and inbox summary-only privacy", async () => {
    await upsert(COLLECTIONS.accounts, {
      id: "acc_ig",
      platform: "Instagram",
      connectionState: "CONNECTED",
      displayName: "_djcoast",
      handle: "@_djcoast",
      providerAccountId: "ig_1",
      managedProfileId: WORKSPACE_A,
    });
    await upsert(COLLECTIONS.analytics, {
      id: "metric_1",
      platform: "Instagram",
      accountId: "acc_ig",
      managedProfileId: WORKSPACE_A,
      metrics: { views: 12, likes: null, comments: undefined },
      recordedAt: new Date().toISOString(),
    });
    await upsert(COLLECTIONS.inbox, {
      id: "inbox_1",
      type: "message",
      read: false,
      handled: false,
      body: "SECRET DM BODY THAT MUST NOT LEAK",
      text: "also secret",
      contentId: "cnt_1",
      managedProfileId: WORKSPACE_A,
    });
    setAccountTokens("instagram", "acc_ig", {
      accessToken: "live-instagram-token-value",
      refreshToken: "live-refresh-token-value",
      scopes: ["instagram_basic"],
    });

    const opened = await openSession();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    const context = await readContext(authed);
    expect(context.ok).toBe(true);
    expect(context.context.product.statement).toBe(NORTH_STAR.statement);
    expect(context.context.product.humanControl).toMatch(/final control/i);
    expect(context.context.accounts.items[0].platform).toBe("Instagram");
    expect(context.context.analytics.facts[0].metrics.views).toBe(12);
    expect(context.context.analytics.facts[0].metrics.likes).toBeNull();
    expect(context.context.analytics.interpretation.note).toMatch(/null/i);
    expect(context.context.inbox.privacy).toBe("SUMMARY_ONLY");
    expect(context.context.inbox.messageCount).toBe(1);
    expect(context.context.inbox.unreadCount).toBe(1);
    expect(JSON.stringify(context)).not.toContain("SECRET DM BODY");
    expect(JSON.stringify(context)).not.toContain("live-instagram-token-value");
    expect(JSON.stringify(context)).not.toContain("live-refresh-token-value");
    expect(context.context.boundaries.agentMayPublish).toBe(false);
    expect(context.context.boundaries.humanOperatorRetainsFinalControl).toBe(true);

    const foreign = await upsert(COLLECTIONS.accounts, {
      id: "acc_other",
      platform: "TikTok",
      connectionState: "CONNECTED",
      managedProfileId: WORKSPACE_B,
    });
    expect(foreign.id).toBe("acc_other");
    const again = await readContext(authed);
    expect(JSON.stringify(again.context.accounts)).not.toContain("TikTok");
    expect(JSON.stringify(again.context.accounts)).not.toContain("acc_other");

    const operations = await readOperations(authed);
    expect(operations.ok).toBe(true);
    expect(operations.operations.social.connectedCount).toBe(1);

    const northStar = await readNorthStar(authed);
    expect(northStar.agentRole).toBe("trusted analyst / product collaborator");
    const capabilities = await readCapabilities(authed);
    expect(capabilities.allowed).toContain("SUBMIT_PROPOSAL");
  });

  it("preserves analytics nulls and inbox summary helpers independently", () => {
    const analytics = summarizeAnalytics([{
      id: "s1",
      platform: "YouTube",
      metrics: { views: null, likes: 3 },
    }]);
    expect(analytics.facts[0].metrics.views).toBeNull();
    expect(analytics.facts[0].metrics.likes).toBe(3);

    const inbox = summarizeInbox([
      { type: "comment", read: false, handled: false, body: "hidden" },
      { type: "mention", read: true, handled: true, text: "hidden" },
      { type: "dm", read: false, handled: false, contentId: "c1", campaignId: "camp1" },
    ]);
    expect(inbox.commentCount).toBe(1);
    expect(inbox.mentionCount).toBe(1);
    expect(inbox.messageCount).toBe(1);
    expect(inbox.contentLinkedCount).toBe(1);
    expect(inbox.campaignLinkedCount).toBe(1);
    expect(JSON.stringify(inbox)).not.toContain("hidden");
  });

  it("records proposals, accepts without execution, dismisses, and refuses denied control", async () => {
    await upsert(COLLECTIONS.campaigns, {
      id: "camp_1",
      name: "Launch",
      status: "ACTIVE",
      managedProfileId: WORKSPACE_A,
    });
    await upsert(COLLECTIONS.queue, {
      id: "q_1",
      status: "PENDING",
      managedProfileId: WORKSPACE_A,
    });
    const beforeCampaigns = await list(COLLECTIONS.campaigns);
    const beforeQueue = await list(COLLECTIONS.queue);

    const opened = await openSession();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });

    const proposal = submitProposal(authed, {
      type: "readiness",
      title: "Clarify Instagram public media blocker",
      summary: "Operator still needs Blob configuration.",
      recommendedAction: "Keep Instagram blocked until public media is configured. Do not publish.",
      evidenceReferences: ["metric_1", "publicMedia"],
      category: "readiness",
    });
    expect(proposal.ok).toBe(true);
    expect(proposal.execution).toBe("never_auto_executed");
    expect(proposal.proposal.status).toBe("recorded");

    const listed = listAgentProposals(authed);
    expect(listed.proposals).toHaveLength(1);

    const accepted = reviewOperatorProposal({
      workspaceId: WORKSPACE_A,
      proposalId: proposal.proposal.id,
      status: "accepted",
      operatorId: "op_test",
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.execution).toBe("never_auto_executed");
    expect(accepted.proposal.status).toBe("accepted");
    expect(accepted.note).toMatch(/Nothing was executed/i);

    const afterCampaigns = await list(COLLECTIONS.campaigns);
    const afterQueue = await list(COLLECTIONS.queue);
    expect(afterCampaigns).toEqual(beforeCampaigns);
    expect(afterQueue).toEqual(beforeQueue);

    const second = submitProposal(authed, {
      title: "Another idea",
      recommendation: "Review captions",
    });
    const dismissed = reviewOperatorProposal({
      workspaceId: WORKSPACE_A,
      proposalId: second.proposal.id,
      status: "dismissed",
      operatorId: "op_test",
    });
    expect(dismissed.proposal.status).toBe("dismissed");

    expect(isDeniedAction("PUBLISH")).toBe(true);
    expect(DENIED_ACTIONS).toContain("READ_PROVIDER_TOKENS");
    expect(DENIED_ACTIONS).toContain("EXECUTE_PROPOSAL");
    expect(DENIED_ACTIONS).toContain("BYPASS_APPROVAL");
    for (const action of DENIED_ACTIONS) {
      expect(isDeniedAction(action)).toBe(true);
    }

    const denied = submitProposal(authed, {
      title: "Publish now",
      recommendation: "Post immediately",
      category: "PUBLISH",
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("ACTION_DENIED");

    const control = denyControlAttempt(authed, "publish");
    expect(control.ok).toBe(false);
    expect(control.status).toBe(403);

    const operatorView = listOperatorProposals({ workspaceId: WORKSPACE_A });
    expect(operatorView.proposals.length).toBeGreaterThanOrEqual(2);

    const ended = closeSession(authed);
    expect(ended.ok).toBe(true);
    const after = await readContext(authed);
    expect(after.ok).toBe(false);
    expect(after.code).toBe("SESSION_REQUIRED");
  });

  it("denies cross-workspace proposal review and keeps secret fields scrubbed", async () => {
    const opened = await openSession();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    const proposal = submitProposal(authed, {
      title: "Workspace A idea",
      recommendation: "Stay put",
    });
    const cross = reviewOperatorProposal({
      workspaceId: WORKSPACE_B,
      proposalId: proposal.proposal.id,
      status: "accepted",
      operatorId: "op_other",
    });
    expect(cross.ok).toBe(false);

    const scrubbed = scrubValue({
      accessToken: "super-secret-token-value-1234567890",
      nested: { refreshToken: "refresh-secret-value-1234567890", ok: true },
      pairingCredential: "rlp_should_redact_this_value_aaaaaaaa",
      sessionToken: "eas_tok_should_redact_this_value_bbbbbbbb",
    });
    expect(scrubbed.accessToken).toBe("[redacted]");
    expect(scrubbed.nested.refreshToken).toBe("[redacted]");
    expect(scrubbed.pairingCredential).toBe("[redacted]");
    expect(scrubbed.sessionToken).toBe("[redacted]");
  });

  it("writes required audit events without plaintext secrets", async () => {
    const created = startPairing();
    cancelOperatorPairing({ workspaceId: WORKSPACE_A });
    const opened = await openSession();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    await readContext(authed);
    submitProposal(authed, { title: "A", recommendation: "B" });
    denyControlAttempt(authed, "RUN_SHELL");
    closeSession(authed);

    const audit = readSecrets().externalAgent.audit.map((row) => row.action);
    expect(audit).toEqual(expect.arrayContaining([
      AUDIT.PAIRING_CREATED,
      AUDIT.PAIRING_CANCELLED,
      AUDIT.PAIRING_CONSUMED,
      AUDIT.SESSION_CREATED,
      AUDIT.CONTEXT_READ,
      AUDIT.PROPOSAL_SUBMITTED,
      AUDIT.REQUEST_DENIED,
      AUDIT.SESSION_REVOKED,
    ]));
    const blob = JSON.stringify(readSecrets().externalAgent.audit);
    expect(blob).not.toContain(created.pairingCredential);
    expect(blob).not.toContain(opened.sessionToken);
    expect(blob).not.toMatch(/Authorization/i);
  });

  it("documents that Investools paths and ports are outside the bridge", () => {
    expect(JSON.stringify(getBridgeStatus(WORKSPACE_A))).not.toContain("investools");
    expect(JSON.stringify(getBridgeStatus(WORKSPACE_A))).not.toContain("5173");
    expect(JSON.stringify(getBridgeStatus(WORKSPACE_A))).not.toContain("3001");
    expect(JSON.stringify(getBridgeStatus(WORKSPACE_A))).not.toContain("3010");
  });

  it("wires rate limiting on bridge HTTP routes without standing secrets", async () => {
    const { readFileSync } = await import("node:fs");
    const handshake = readFileSync(join(process.cwd(), "app/api/external-agent/handshake/route.ts"), "utf8");
    const proposals = readFileSync(join(process.cwd(), "app/api/external-agent/proposals/route.ts"), "utf8");
    expect(handshake).toContain("rateLimit");
    expect(proposals).toContain("rateLimit");
    expect(handshake).not.toContain("EXTERNAL_AGENT_BRIDGE_SECRET");
  });
});
