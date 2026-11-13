"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US");
}

function remainingLabel(expiresAt, nowMs) {
  if (!expiresAt) return "—";
  const ms = Date.parse(expiresAt) - nowMs;
  if (!Number.isFinite(ms)) return "—";
  if (ms <= 0) return "Expired";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function stateHeadline(state, transportBlocked) {
  if (transportBlocked) return "REMOTE TRANSPORT REQUIRED";
  switch (state) {
    case "DISABLED":
      return "DISABLED";
    case "READY":
    case "READY_FOR_PAIRING":
      return "READY TO CONNECT";
    case "WAITING_FOR_AGENT":
    case "PAIRING_ACTIVE":
      return "WAITING FOR AGENT";
    case "CONNECTED":
    case "PAIRED":
      return "CONNECTED";
    case "REMOTE_TRANSPORT_REQUIRED":
      return "REMOTE TRANSPORT REQUIRED";
    case "ERROR":
      return "ERROR";
    default:
      return state || "UNKNOWN";
  }
}

export default function ExternalAgentBridgePanel() {
  const [status, setStatus] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [pairingCredential, setPairingCredential] = useState("");
  const [pairingMeta, setPairingMeta] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [agentKey, setAgentKey] = useState("mr_post");
  const [connectionMode, setConnectionMode] = useState("LOCAL_TEST_CLIENT");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRes, proposalsRes] = await Promise.all([
        fetch("/api/external-agent/operator", { credentials: "same-origin" }),
        fetch("/api/external-agent/operator?view=proposals", { credentials: "same-origin" }),
      ]);
      const statusBody = await statusRes.json().catch(() => ({}));
      const proposalsBody = await proposalsRes.json().catch(() => ({}));
      if (!statusRes.ok || statusBody.ok === false) {
        setError(statusBody.error || "Could not load External Agent Bridge status.");
        setStatus(null);
      } else {
        setStatus(statusBody);
        if (statusBody.state === "CONNECTED" || statusBody.state === "PAIRED" || statusBody.state === "READY") {
          setPairingCredential("");
          setPairingMeta(null);
        }
        if (statusBody.state === "CONNECTED" || statusBody.state === "PAIRED") {
          setStep(4);
        } else if (statusBody.state === "WAITING_FOR_AGENT" || statusBody.state === "PAIRING_ACTIVE") {
          setStep(4);
        }
      }
      setProposals(Array.isArray(proposalsBody.proposals) ? proposalsBody.proposals : []);
    } catch {
      setError("Could not load External Agent Bridge status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const waiting = status?.state === "WAITING_FOR_AGENT" || status?.state === "PAIRING_ACTIVE";
    if (!waiting) return undefined;
    const id = window.setInterval(() => {
      refresh();
    }, 4000);
    return () => window.clearInterval(id);
  }, [status?.state, refresh]);

  const selectedAgent = useMemo(() => {
    const list = Array.isArray(status?.agents) ? status.agents : [];
    return list.find((row) => row.key === agentKey) || null;
  }, [status, agentKey]);

  const remoteBlocked = connectionMode === "REMOTE_AGENT";
  const state = status?.state || "DISABLED";
  const session = status?.session;
  const pairing = status?.pairing;
  const roster = Array.isArray(status?.roster) ? status.roster : [];
  const headline = stateHeadline(
    remoteBlocked && state !== "CONNECTED" && state !== "PAIRED" ? "REMOTE_TRANSPORT_REQUIRED" : state,
    remoteBlocked && state !== "CONNECTED" && state !== "PAIRED",
  );

  async function runAction(action, extra = {}) {
    setBusy(true);
    setNote("");
    setError("");
    try {
      const res = await fetch("/api/external-agent/operator", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        setError(body.operatorMessage || body.error || "Action failed.");
        if (body.code === "REMOTE_TRANSPORT_REQUIRED") {
          setPairingCredential("");
          setPairingMeta(null);
        }
        return;
      }
      if (action === "start_pairing" && body.pairingCredential) {
        setPairingCredential(body.pairingCredential);
        setPairingMeta({
          instructions: body.instructions,
          agent: body.agent,
          connectionMode: body.connectionMode,
          pairing: body.pairing,
          warning: body.warning,
        });
        setNote("Credential created. Waiting for the local agent handshake.");
        setStep(4);
      } else if (action === "cancel_pairing") {
        setPairingCredential("");
        setPairingMeta(null);
        setNote("Pairing cancelled. Credential invalidated.");
        setStep(1);
      } else if (action === "revoke_session") {
        setPairingCredential("");
        setPairingMeta(null);
        setNote("External agent session revoked.");
        setStep(1);
      } else if (action === "accept_proposal") {
        setNote("Proposal accepted as a recorded recommendation. Nothing was executed.");
      } else if (action === "dismiss_proposal") {
        setNote("Proposal dismissed.");
      }
      await refresh();
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredential() {
    if (!pairingCredential) return;
    try {
      await navigator.clipboard.writeText(pairingCredential);
      setNote("Credential copied. Paste only into the secure Secrets field — never into chat.");
    } catch {
      setNote("Copy failed. Select the credential and copy it manually.");
    }
  }

  function startPairing() {
    if (remoteBlocked) {
      setError("REMOTE AGENT CONNECTION NOT CONFIGURED. ReGeneLuxe is local-only and no remote agent transport is configured.");
      return;
    }
    return runAction("start_pairing", { agentKey, connectionMode });
  }

  return (
    <section id="external-agent-bridge" className="rl-panel space-y-5 p-5">
      <div>
        <h2 className="text-sm font-semibold text-rl_text">Agents</h2>
        <p className="mt-1 text-sm text-rl_muted">
          Connect a trusted external agent to this workspace. ReGeneLuxe remains the system of record — agents may
          recommend and draft; they cannot approve, publish, or touch credentials.
        </p>
      </div>

      <div className="rounded-xl border border-rl_border bg-rl_surfaceActive/30 p-3 text-sm text-rl_muted">
        <p className="font-medium text-rl_text">Transport truth</p>
        <p className="mt-1">
          ReGeneLuxe currently accepts agent connections only through its local runtime
          ({status?.transport?.acceptedHosts?.join(" / ") || "127.0.0.1 / localhost"}:
          {status?.transport?.acceptedPort || 5174}).
        </p>
        <p className="mt-1">
          A remote Grok agent cannot reach this machine until a secure outbound rendezvous/relay exists. This UI will
          not invent a public tunnel or expose port 5174.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">Team</h3>
        <ul className="space-y-2">
          {(roster.length ? roster : [
            { key: "mr_entrepreneur", label: "MR ENTREPRENEUR", subtitle: "Strategy & Rollout", status: "DISCONNECTED" },
            { key: "mr_post", label: "MR POST", subtitle: "Content Operator", status: "DISCONNECTED" },
          ]).map((row) => (
            <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rl_border pb-2 last:border-0">
              <div>
                <p className="text-sm font-medium text-rl_text">{row.label}</p>
                <p className="text-xs text-rl_muted">{row.subtitle}</p>
              </div>
              <span className="text-xs font-semibold tracking-wide text-rl_muted">{row.status}</span>
            </li>
          ))}
        </ul>
      </div>

      {loading && !status ? (
        <p className="text-sm text-rl_muted">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-rl_text">Connection status · {headline}</p>
            {state === "DISABLED" ? (
              <p className="text-xs text-rl_muted">Enable with EXTERNAL_AGENT_BRIDGE_ENABLED=1, then restart.</p>
            ) : null}
          </div>

          {(state === "CONNECTED" || state === "PAIRED") && session ? (
            <div className="space-y-3 rounded-xl border border-rl_border p-4">
              <p className="text-sm font-semibold text-rl_text">
                {session.displayName || session.agentType || "External agent"} connected
              </p>
              <ul className="space-y-1 text-sm text-rl_muted">
                <li>Role · {session.agentRole || "—"}</li>
                <li>Workspace · {session.workspaceName || session.workspaceId || "—"}</li>
                <li>Session expires · {formatWhen(session.expiresAt)}</li>
              </ul>
              {Array.isArray(session.capabilities) && session.capabilities.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">Capabilities</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-rl_muted">
                    {session.capabilities.map((cap) => (
                      <li key={cap}>{cap}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                className="rl-btn-ghost px-3 py-1.5 text-xs"
                onClick={() => runAction("revoke_session")}
                disabled={busy}
              >
                Revoke session
              </button>
            </div>
          ) : null}

          {state !== "CONNECTED" && state !== "PAIRED" && state !== "DISABLED" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">
                  Step 1 — Choose agent
                </p>
                <div className="flex flex-wrap gap-2">
                  {(status?.agents || []).map((agent) => (
                    <button
                      key={agent.key}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        agentKey === agent.key
                          ? "border-rl_text bg-rl_surfaceActive text-rl_text"
                          : "border-rl_border text-rl_muted"
                      }`}
                      onClick={() => {
                        setAgentKey(agent.key);
                        setStep(Math.max(step, 2));
                      }}
                      disabled={busy}
                    >
                      {agent.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">Step 2 — Role</p>
                <p className="text-sm text-rl_text">
                  {selectedAgent?.label || "Agent"} · {selectedAgent?.roleLabel || selectedAgent?.role || "—"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">
                  Step 3 — Permissions
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ul className="space-y-1 text-sm text-rl_muted">
                    {(selectedAgent?.allowedPlain || []).map((line) => (
                      <li key={`ok-${line}`}>✓ {line}</li>
                    ))}
                  </ul>
                  <ul className="space-y-1 text-sm text-rl_muted">
                    {(selectedAgent?.deniedPlain || []).map((line) => (
                      <li key={`no-${line}`}>✗ {line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">
                  Step 4 — Connection mode
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["LOCAL_TEST_CLIENT", "Local test client"],
                    ["REMOTE_AGENT", "Remote agent"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        connectionMode === value
                          ? "border-rl_text bg-rl_surfaceActive text-rl_text"
                          : "border-rl_border text-rl_muted"
                      }`}
                      onClick={() => setConnectionMode(value)}
                      disabled={busy}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {remoteBlocked ? (
                  <div className="rounded-xl border border-rl_border p-3 text-sm text-rl_muted">
                    <p className="font-semibold text-rl_text">
                      {selectedAgent?.label || "Agent"} cannot connect yet
                    </p>
                    <p className="mt-1">
                      ReGeneLuxe is local-only and no remote agent transport is configured. No pairing credential will
                      be created.
                    </p>
                    <p className="mt-2 text-xs font-semibold tracking-wide">REMOTE AGENT CONNECTION NOT CONFIGURED</p>
                  </div>
                ) : (
                  <p className="text-xs text-rl_muted">
                    Local client only — the agent process must reach http://localhost:5174 on this machine.
                  </p>
                )}
              </div>

              {!remoteBlocked && !pairingCredential && state !== "WAITING_FOR_AGENT" && state !== "PAIRING_ACTIVE" ? (
                <button
                  type="button"
                  className="rl-btn-ghost px-3 py-1.5 text-xs"
                  onClick={startPairing}
                  disabled={busy || !agentKey}
                >
                  Create temporary pairing credential
                </button>
              ) : null}

              {(pairingCredential || state === "WAITING_FOR_AGENT" || state === "PAIRING_ACTIVE") && !remoteBlocked ? (
                <div className="space-y-3 rounded-xl border border-rl_border bg-rl_surfaceActive/40 p-4">
                  <p className="text-sm font-semibold text-rl_text">Temporary certification pairing</p>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-rl_muted">
                    {(pairingMeta?.instructions?.steps || [
                      "Open the intended local test client on this machine.",
                      "Open the secure Secrets field (not chat).",
                      "Copy the credential below.",
                      "Paste it into REGENELUXE_PAIRING_CREDENTIAL.",
                      "Do NOT paste the credential into normal chat.",
                      "Return here. Status stays WAITING FOR AGENT until handshake succeeds.",
                    ]).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                  <ul className="space-y-1 text-sm text-rl_muted">
                    <li>
                      Expires in ·{" "}
                      {remainingLabel(pairingMeta?.pairing?.expiresAt || pairing?.expiresAt, nowMs)}
                    </li>
                    <li>Used · {(pairingMeta?.pairing?.used ?? pairing?.used) ? "Yes" : "No"}</li>
                    <li>Agent · {pairingMeta?.agent?.label || pairing?.agentLabel || selectedAgent?.label || "—"}</li>
                    <li>Workspace · {pairing?.workspaceName || pairingMeta?.pairing?.workspaceName || "—"}</li>
                    <li>Role · {pairingMeta?.agent?.role || pairing?.agentRole || selectedAgent?.role || "—"}</li>
                    <li>Status · WAITING FOR AGENT</li>
                  </ul>
                  {pairingCredential ? (
                    <>
                      <code className="block break-all rounded-lg border border-rl_border bg-rl_bg/40 p-2 text-xs text-rl_text">
                        {pairingCredential}
                      </code>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rl-btn-ghost px-3 py-1.5 text-xs" onClick={copyCredential} disabled={busy}>
                          Copy credential
                        </button>
                        <button
                          type="button"
                          className="rl-btn-ghost px-3 py-1.5 text-xs"
                          onClick={() => runAction("cancel_pairing")}
                          disabled={busy}
                        >
                          Cancel pairing
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <p className="text-xs text-rl_muted">
                        Credential was already shown once. Cancel and create a new one if the agent still needs to pair.
                      </p>
                      <button
                        type="button"
                        className="rl-btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => runAction("cancel_pairing")}
                        disabled={busy}
                      >
                        Cancel pairing
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {note ? <p className="text-xs text-rl_muted">{note}</p> : null}
          {error ? <p className="text-xs text-rl_danger">{error}</p> : null}

          <div className="space-y-3 border-t border-rl_border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">
              Recent external-agent proposals
            </h3>
            {proposals.length === 0 ? (
              <p className="text-sm text-rl_muted">No proposals yet.</p>
            ) : (
              <ul className="space-y-3">
                {proposals.slice(0, 12).map((proposal) => (
                  <li key={proposal.id} className="space-y-2 border-b border-rl_border pb-3 last:border-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-rl_text">{proposal.title}</p>
                      <span className="text-xs text-rl_muted">{proposal.status}</span>
                    </div>
                    <p className="text-xs text-rl_muted">
                      {proposal.type || "recommendation"} · {proposal.displayName || proposal.agentType || "agent"} ·{" "}
                      {formatWhen(proposal.createdAt)}
                    </p>
                    {proposal.summary ? <p className="text-sm text-rl_muted">{proposal.summary}</p> : null}
                    {proposal.recommendation ? (
                      <p className="text-sm text-rl_text">Recommended · {proposal.recommendation}</p>
                    ) : null}
                    {proposal.status === "recorded" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rl-btn-ghost px-3 py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => runAction("accept_proposal", { proposalId: proposal.id })}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="rl-btn-ghost px-3 py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => runAction("dismiss_proposal", { proposalId: proposal.id })}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-rl_muted">
              Accept records agreement with the recommendation. It does not publish, schedule, or change campaign state.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
