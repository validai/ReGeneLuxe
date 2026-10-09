import { useEffect, useState } from "react";
import SideSheet from "./SideSheet.jsx";
import DestinationPicker from "./DestinationPicker.jsx";
import {
  CONNECTION_FAILURES,
  connectProvider,
  liveConnectProviders,
  readinessForProvider,
} from "../../data/connectionFlow.js";

export default function ConnectAccountSheet({
  open,
  onClose,
  workspaceName = "this workspace",
  definitions = [],
  initialStep = "picker",
  initialProvider = "",
  destinations = [],
  failure = "",
  preview = false,
  needsChoice = [],
  onStart,
  onConfirm,
  onCancelSession,
}) {
  const [step, setStep] = useState(initialStep);
  const [providerId, setProviderId] = useState(initialProvider);
  const [selectedIds, setSelectedIds] = useState([]);
  const [choices, setChoices] = useState({});
  const [localFailure, setLocalFailure] = useState(failure);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    setProviderId(initialProvider);
    setLocalFailure(failure);
    setSelectedIds([]);
    setChoices({});
  }, [open, initialStep, initialProvider, failure]);

  const provider = connectProvider(providerId);
  const failureCopy = CONNECTION_FAILURES[localFailure] || null;

  const choose = (id) => {
    const spec = connectProvider(id);
    const status = readinessForProvider(id, definitions);
    setProviderId(id);
    setSelectedIds([]);
    if (!spec?.live || status.readiness !== "IMPLEMENTED") {
      const next = status.readiness === "SETUP_REQUIRED"
        ? "setup"
        : status.readiness === "PROVIDER_REVIEW_REQUIRED"
          ? "review"
          : "unavailable";
      setLocalFailure(next);
      setStep("failure");
      return;
    }
    setLocalFailure("");
    setStep("continue");
  };

  const start = async () => {
    if (preview) return;
    setBusy(true);
    try {
      const result = await onStart?.(providerId);
      if (result && !result.authUrl && result.failure) {
        setLocalFailure(result.failure);
        setStep("failure");
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const confirm = async () => {
    if (preview || selectedIds.length === 0) return;
    setBusy(true);
    try {
      const result = await onConfirm?.(selectedIds, choices);
      if (result?.failure === "match") setStep("match");
      else if (result?.failure) {
        setLocalFailure(result.failure);
        setStep("failure");
      }
    } finally {
      setBusy(false);
    }
  };

  const title = step === "destinations"
    ? "Choose destinations"
    : step === "continue"
      ? `Connect ${provider?.label || "account"}`
      : step === "failure"
        ? (failureCopy?.title || "Connection")
        : step === "match"
          ? "Link verified account"
          : "Connect an account";

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={step === "picker" ? "Provider sign-in verifies the identity. A typed handle does not." : `Workspace: ${workspaceName}`}
      footer={footer()}
    >
      {preview ? <p className="mb-3 text-xs uppercase tracking-[0.14em] text-rl_muted">Preview</p> : null}
      {step === "picker" ? (
        <ul className="space-y-2">
          {liveConnectProviders().map((item) => {
            const status = readinessForProvider(item.id, definitions);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-rl_border px-4 py-3 text-left hover:border-rl_borderStrong"
                  onClick={() => choose(item.id)}
                >
                  <span className="text-sm font-medium text-rl_text">{item.label}</span>
                  <span className="text-xs text-rl_muted">{status.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {step === "continue" && provider ? (
        <div className="space-y-3 text-sm text-rl_text">
          <p>Connecting: {provider.label}</p>
          <p className="text-rl_muted">ReGeneLuxe sign-in does not choose this destination. You confirm it after the provider returns.</p>
        </div>
      ) : null}
      {step === "destinations" ? (
        <DestinationPicker
          destinations={destinations}
          selectedIds={selectedIds}
          onToggle={toggle}
          legend={provider?.grant === "meta" || destinations.some((item) => item.provider === "instagram" || item.provider === "facebook")
            ? "Connected Meta identities"
            : "Destinations"}
        />
      ) : null}
      {step === "match" ? (
        <ul className="space-y-4">
          {needsChoice.map((item) => (
            <li key={item.destination.id} className="space-y-2 rounded-xl border border-rl_border p-3">
              <p className="text-sm text-rl_text">
                {item.destination.platform} {item.destination.handle || item.destination.name} looks like {item.label}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rl-btn-ghost"
                  onClick={() => setChoices((current) => ({ ...current, [item.destination.id]: "link" }))}
                >
                  Link verified account to existing entry
                </button>
                <button
                  type="button"
                  className="rl-btn-ghost"
                  onClick={() => setChoices((current) => ({ ...current, [item.destination.id]: "separate" }))}
                >
                  Create separate verified account
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {step === "failure" && failureCopy ? (
        <div className="space-y-2 text-sm">
          <p className="text-rl_text">{failureCopy.body}</p>
        </div>
      ) : null}
    </SideSheet>
  );

  function footer() {
    if (step === "continue") {
      return (
        <div className="flex justify-end gap-2">
          <button type="button" className="rl-btn-ghost" onClick={() => setStep("picker")}>Back</button>
          <button type="button" className="rl-btn" onClick={start} disabled={busy || preview}>
            {provider?.continueWith || "Continue"}
          </button>
        </div>
      );
    }
    if (step === "destinations" || step === "match") {
      return (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rl-btn-ghost"
            onClick={() => {
              onCancelSession?.();
              onClose?.();
            }}
          >
            Cancel
          </button>
          <button type="button" className="rl-btn" onClick={confirm} disabled={busy || preview || selectedIds.length === 0}>
            Add selected
          </button>
        </div>
      );
    }
    if (step === "failure") {
      return (
        <div className="flex justify-end">
          <button type="button" className="rl-btn" onClick={() => { setLocalFailure(""); setStep("picker"); }}>
            {failureCopy?.action || "Back"}
          </button>
        </div>
      );
    }
    return (
      <div className="flex justify-end">
        <button type="button" className="rl-btn-ghost" onClick={onClose}>Close</button>
      </div>
    );
  }
}
