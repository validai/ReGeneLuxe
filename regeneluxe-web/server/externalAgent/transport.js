/**
 * External Agent Bridge transport truth.
 *
 * V1 accepts agent connections only on the local ReGeneLuxe runtime (127.0.0.1 / localhost:5174).
 * There is no remote rendezvous/relay. Do not generate pairing credentials for REMOTE_AGENT
 * until a secure outbound transport exists.
 */

export const CONNECTION_MODES = Object.freeze({
  LOCAL_TEST_CLIENT: "LOCAL_TEST_CLIENT",
  REMOTE_AGENT: "REMOTE_AGENT",
});

export const TRANSPORT_STATUS = Object.freeze({
  LOCAL_ONLY: "LOCAL_ONLY",
  READY_LOCAL: "READY_LOCAL",
  REMOTE_NOT_CONFIGURED: "REMOTE_NOT_CONFIGURED",
  REMOTE_TRANSPORT_REQUIRED: "REMOTE_TRANSPORT_REQUIRED",
});

export function normalizeConnectionMode(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (raw === CONNECTION_MODES.LOCAL_TEST_CLIENT || raw === "LOCAL" || raw === "LOCAL_CLIENT") {
    return CONNECTION_MODES.LOCAL_TEST_CLIENT;
  }
  if (raw === CONNECTION_MODES.REMOTE_AGENT || raw === "REMOTE") {
    return CONNECTION_MODES.REMOTE_AGENT;
  }
  return null;
}

export function resolveTransport({ connectionMode } = {}) {
  const mode = normalizeConnectionMode(connectionMode);
  const localRuntimeOnly = true;
  const remoteRelayConfigured = false;

  if (!mode) {
    return {
      ok: false,
      status: 400,
      code: "CONNECTION_MODE_REQUIRED",
      error: "Choose a connection mode before starting pairing.",
      connectionMode: null,
      transportStatus: TRANSPORT_STATUS.LOCAL_ONLY,
      localRuntimeOnly,
      remoteRelayConfigured,
      remoteAgentCanConnect: false,
      operatorMessage: "ReGeneLuxe currently accepts agent connections only through its local runtime.",
    };
  }

  if (mode === CONNECTION_MODES.REMOTE_AGENT) {
    return {
      ok: false,
      status: 503,
      code: "REMOTE_TRANSPORT_REQUIRED",
      error: "REMOTE AGENT CONNECTION NOT CONFIGURED",
      connectionMode: mode,
      transportStatus: TRANSPORT_STATUS.REMOTE_NOT_CONFIGURED,
      localRuntimeOnly,
      remoteRelayConfigured,
      remoteAgentCanConnect: false,
      operatorMessage:
        "ReGeneLuxe is local-only and no remote agent transport is configured. Do not expose localhost publicly. A future secure rendezvous/relay (outbound from ReGeneLuxe) is required before a remote Grok agent can connect.",
    };
  }

  return {
    ok: true,
    status: 200,
    code: "READY_LOCAL",
    error: null,
    connectionMode: mode,
    transportStatus: TRANSPORT_STATUS.READY_LOCAL,
    localRuntimeOnly,
    remoteRelayConfigured,
    remoteAgentCanConnect: false,
    operatorMessage:
      "ReGeneLuxe currently accepts agent connections only through its local runtime. Use a local test client on this machine for certification pairing.",
  };
}

export function transportPublicTruth() {
  return {
    localRuntimeOnly: true,
    remoteRelayConfigured: false,
    remoteAgentCanConnect: false,
    acceptedHosts: ["127.0.0.1", "localhost"],
    acceptedPort: 5174,
    note: "Remote agents (including Grok) cannot reach this runtime until a secure outbound rendezvous/relay exists. Pairing credentials are never generated for REMOTE_AGENT while transport is unconfigured.",
    futureDirection:
      "remote agent ↔ secure rendezvous/relay ↔ outbound connection from local ReGeneLuxe. No provider credentials or database contents in the relay.",
  };
}
