"use client";

import { useCallback, useEffect, useState } from "react";

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US");
}

function stateLabel(state) {
  switch (state) {
    case "DISABLED":
      return "Disabled";
    case "READY_FOR_PAIRING":
      return "Ready for pairing";
    case "PAIRING_ACTIVE":
      return "Pairing active";
    case "PAIRED":
      return "Paired";
    default:
      return state || "Unknown";
  }
}

export default function ExternalAgentBridgePanel() {
  const [status, setStatus] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [pairingCredential, setPairingCredential] = useState("");
  const [error, setError] = useState("");

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
        if (statusBody.state === "PAIRED" || statusBody.state === "READY_FOR_PAIRING") {
          setPairingCredential("");
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
        setError(body.error || "Action failed.");
        return;
      }
      if (action === "start_pairing" && body.pairingCredential) {
        setPairingCredential(body.pairingCredential);
        setNote(body.warning || "Copy this one-time pairing credential now. It will not be shown again.");
      } else if (action === "cancel_pairing") {
        setPairingCredential("");
        setNote("Pairing cancelled.");
      } else if (action === "revoke_session") {
        setPairingCredential("");
        setNote("External agent session revoked.");
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
      setNote("Pairing credential copied. It expires in about 10 minutes and can be used once.");
    } catch {
      setNote("Copy failed. Select the credential and copy it manually.");
    }
  }

  const state = status?.state || "DISABLED";
  const session = status?.session;
  const pairing = status?.pairing;

  return (
    <section id="external-agent-bridge" className="rl-panel space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-rl_text">External Agent Bridge</h2>
        <p className="mt-1 text-sm text-rl_muted">
          Local, operator-initiated pairing for a trusted analyst agent. Proposals are recorded only — never auto-executed.
        </p>
      </div>

      {loading && !status ? (
        <p className="text-sm text-rl_muted">Loading…</p>
      ) : (
        <>
          <ul className="space-y-1 text-sm text-rl_muted">
            <li>Status · {stateLabel(state)}</li>
            {state === "DISABLED" ? (
              <li>Enable locally with EXTERNAL_AGENT_BRIDGE_ENABLED=1, then restart when ready.</li>
            ) : null}
            {state === "PAIRING_ACTIVE" && pairing?.expiresAt ? (
              <li>Pairing expires · {formatWhen(pairing.expiresAt)}</li>
            ) : null}
            {state === "PAIRED" && session ? (
              <>
                <li>Agent · {session.displayName || session.agentType || "External agent"}</li>
                <li>Access · Read + propose</li>
                <li>Session expires · {formatWhen(session.expiresAt)}</li>
              </>
            ) : null}
          </ul>

          {pairingCredential ? (
            <div className="space-y-2 rounded-xl border border-rl_border bg-rl_surfaceActive/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">One-time pairing credential</p>
              <code className="block break-all text-xs text-rl_text">{pairingCredential}</code>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rl-btn-ghost px-3 py-1.5 text-xs" onClick={copyCredential} disabled={busy}>
                  Copy
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
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(state === "READY_FOR_PAIRING" || state === "PAIRING_ACTIVE") && !pairingCredential ? (
              <button
                type="button"
                className="rl-btn-ghost px-3 py-1.5 text-xs"
                onClick={() => runAction("start_pairing")}
                disabled={busy}
              >
                Start pairing
              </button>
            ) : null}
            {state === "PAIRING_ACTIVE" && !pairingCredential ? (
              <button
                type="button"
                className="rl-btn-ghost px-3 py-1.5 text-xs"
                onClick={() => runAction("cancel_pairing")}
                disabled={busy}
              >
                Cancel pairing
              </button>
            ) : null}
            {state === "PAIRED" ? (
              <button
                type="button"
                className="rl-btn-ghost px-3 py-1.5 text-xs"
                onClick={() => runAction("revoke_session")}
                disabled={busy}
              >
                Revoke
              </button>
            ) : null}
          </div>

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
                      {proposal.type || "recommendation"} · {proposal.displayName || proposal.agentType || "agent"} · {formatWhen(proposal.createdAt)}
                    </p>
                    {proposal.summary ? <p className="text-sm text-rl_muted">{proposal.summary}</p> : null}
                    {proposal.recommendation ? (
                      <p className="text-sm text-rl_text">Recommended · {proposal.recommendation}</p>
                    ) : null}
                    {Array.isArray(proposal.evidenceReferences) && proposal.evidenceReferences.length > 0 ? (
                      <p className="text-xs text-rl_muted">Evidence · {proposal.evidenceReferences.join(", ")}</p>
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
