import { useEffect, useState } from "react";
import { Link } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import StatusBadge from "../components/app/StatusBadge.jsx";
import EmptyState from "../components/app/EmptyState.jsx";
import ConfirmDialog from "../components/app/ConfirmDialog.jsx";
import SideSheet from "../components/app/SideSheet.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { createAccount, deleteAccount, updateAccount } from "../data/accountRepository.js";
import { PLATFORMS, emptyAccount } from "../data/models.js";
import { PUBLISH_PERMISSIONS, PUBLISH_PERMISSION_LABELS } from "../data/domain.js";
import {
  declaredCapabilities,
  publishMediaSupport,
  startProviderConnect,
  connectionAction,
  refreshAccountAnalytics,
} from "../data/connectors/registry.js";
import { formatStamp } from "../utils/dates.js";
import { useToast } from "../components/app/useToast.js";
import { parseSocialIdentity } from "../data/socialAccountUrl.js";
import { displayConnectionState, formatHandle } from "../data/connectionStatus.js";

const blank = () => emptyAccount({
  platform: "Instagram",
  displayName: "",
  handle: "",
  profileUrl: "",
  active: true,
});

const HEALTH = {
  CONNECTED: { label: "Connected", tone: "bg-rl_ok/15 text-rl_ok" },
  AUTH_EXPIRED: { label: "Reconnect required", tone: "bg-rl_warning/15 text-rl_warning" },
  RECONNECT_REQUIRED: { label: "Reconnect required", tone: "bg-rl_warning/15 text-rl_warning" },
  ERROR: { label: "Reconnect required", tone: "bg-rl_danger/15 text-rl_danger" },
  MANUAL_ONLY: { label: "Manual", tone: "bg-rl_surfaceSoft text-rl_muted" },
  UNCONNECTED: { label: "Not connected", tone: "bg-rl_warning/15 text-rl_warning" },
  CONNECTING: { label: "Connecting", tone: "bg-rl_warning/15 text-rl_warning" },
  SETUP_REQUIRED: { label: "Setup required", tone: "bg-rl_warning/15 text-rl_warning" },
  UNSUPPORTED: { label: "Unsupported", tone: "bg-rl_surfaceSoft text-rl_muted" },
  PROVIDER_REVIEW_REQUIRED: { label: "Provider review required", tone: "bg-rl_warning/15 text-rl_warning" },
};

function healthFor(connectionState) {
  return HEALTH[connectionState] || HEALTH.MANUAL_ONLY;
}

function softCapabilityLine(platform) {
  const caps = declaredCapabilities(platform);
  if (!caps.length) return "Publishing stays manual until a real sign-in exists.";
  const media = publishMediaSupport(platform);
  const bits = [
    media.image ? "Image ✓" : "Image ✕",
    media.video ? "Video ✓" : "Video ✕",
    media.text ? "Text ✓" : null,
  ].filter(Boolean);
  return `When connected: ${bits.join(" · ")}.`;
}

function providerSlug(platform) {
  return String(platform || "").toLowerCase().replace("twitter", "x");
}

export default function AccountsPage() {
  const { accounts, campaigns, content } = useAppData();
  const toast = useToast();
  const [draft, setDraft] = useState(blank());
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [setupMessage, setSetupMessage] = useState("");
  const [identityInput, setIdentityInput] = useState("");
  const [detection, setDetection] = useState(null);
  const [providers, setProviders] = useState([]);

  const selected = accounts.find((account) => account.id === selectedId) || null;

  const readinessFor = (platform) => {
    const id = String(platform || "").toLowerCase().replace("twitter", "x");
    return providers.find((item) => item.provider === id || item.displayName === platform)?.readiness || "";
  };

  const applyIdentity = (value) => {
    setIdentityInput(value);
    const looksUrl = /[./]/.test(value) && !value.trim().startsWith("@");
    const parsed = parseSocialIdentity(value, looksUrl ? {} : { platform: draft.platform });
    setDetection(parsed);
    if (!parsed.ok) return;
    setDraft((current) => ({
      ...current,
      platform: parsed.platform || current.platform,
      handle: parsed.handle ? `@${String(parsed.handle).replace(/^@/, "")}` : current.handle,
      profileUrl: parsed.profileUrl || current.profileUrl,
      displayName: current.displayName || parsed.displayName || parsed.handle || "",
      connectionState: "MANUAL_ONLY",
      connectionMethod: "MANUAL",
    }));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connect = params.get("connect");
    if (!connect) return;
    const message = params.get("message") || "";
    const accountId = params.get("accountId");
    if (connect === "success" && accountId) {
      updateAccount(accountId, {
        connectionState: "CONNECTED",
        connectionMethod: "OAUTH",
        lastSuccessfulSync: new Date().toISOString(),
        lastErrorSummary: "",
      });
      toast?.push?.("Account connected.", "ok");
      setSelectedId(accountId);
    } else if (connect === "error") {
      setSetupMessage(message || "Connection failed.");
      if (accountId) {
        updateAccount(accountId, {
          connectionState: "ERROR",
          lastErrorSummary: message,
        });
      }
    }
    params.delete("connect");
    params.delete("message");
    params.delete("accountId");
    params.delete("provider");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [toast]);

  useEffect(() => {
    fetch("/api/connections")
      .then((res) => res.json())
      .then((body) => {
        if (Array.isArray(body?.providers)) setProviders(body.providers);
      })
      .catch(() => {});
  }, []);

  const runConnect = async (account) => {
    setBusyId(account.id);
    setSetupMessage("");
    try {
      const result = await startProviderConnect(
        providerSlug(account.platform),
        account.id,
        "/accounts",
        account,
      );
      if (result.authUrl) {
        updateAccount(account.id, { connectionState: "CONNECTING", connectionMethod: "OAUTH" });
        window.location.href = result.authUrl;
        return;
      }
      if (result.readiness === "SETUP_REQUIRED" || result.reason === "SETUP_REQUIRED") {
        updateAccount(account.id, {
          connectionState: "SETUP_REQUIRED",
          lastErrorSummary: result.message || "Setup required",
        });
        setSetupMessage(result.instructions || result.message || "Provider setup required.");
        return;
      }
      if (result.readiness === "PROVIDER_REVIEW_REQUIRED") {
        setSetupMessage(result.message || result.reviewNotes || "Available after provider approval.");
        return;
      }
      setSetupMessage(result.error || result.message || "Connect failed.");
    } finally {
      setBusyId(null);
    }
  };

  const runDisconnect = async (account) => {
    setBusyId(account.id);
    try {
      await connectionAction("disconnect", account.id, { provider: providerSlug(account.platform) });
      updateAccount(account.id, {
        connectionState: "UNCONNECTED",
        lastErrorSummary: "",
      });
    } finally {
      setBusyId(null);
    }
  };

  const runRefresh = async (account) => {
    setBusyId(account.id);
    try {
      const sync = await connectionAction("refresh", account.id);
      if (sync.account) {
        updateAccount(account.id, {
          ...sync.account,
          // never copy secrets if somehow present
          accessToken: undefined,
          refreshToken: undefined,
        });
      }
      const analytics = await refreshAccountAnalytics(account.id, { includeContent: true });
      if (!analytics.ok) {
        setSetupMessage(analytics.error || "Analytics refresh failed.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const validate = (data) => {
    const next = {};
    if (!data.platform) next.platform = "Required.";
    if (!data.displayName.trim() && !data.handle.trim()) next.displayName = "Add a display name or handle.";
    return next;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    if (editingId) {
      updateAccount(editingId, { ...draft, connectionState: draft.connectionState || "MANUAL_ONLY" });
    } else {
      createAccount({
        ...draft,
        connectionState: "MANUAL_ONLY",
        connectionMethod: "MANUAL",
      });
    }
    setDraft(blank());
    setEditingId(null);
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setDraft({ ...account });
    setIdentityInput(account.profileUrl || account.handle || "");
    setDetection(parseSocialIdentity(account.profileUrl || account.handle || "", { platform: account.platform }));
    setErrors({});
    setSelectedId(null);
  };

  return (
    <PageShell dense>
      <PageHeader
        title="Accounts"
        description="Social accounts belong to the active profile. Pasting a URL identifies the account. It does not connect it."
      />

      {setupMessage ? (
        <div className="rounded-xl border border-rl_warning/40 bg-rl_warning/10 px-4 py-3 text-sm text-rl_text whitespace-pre-wrap">
          {setupMessage}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-rl_border bg-rl_surface/40 p-5">
        <h2 className="rl-label">{editingId ? "Edit account" : "Add account"}</h2>
        <FormField id="acc-identity" label="Profile / channel URL or handle">
          <input
            id="acc-identity"
            className={fieldClass}
            placeholder="https://www.instagram.com/example or @example"
            value={identityInput}
            onChange={(event) => applyIdentity(event.target.value)}
          />
        </FormField>
        {detection?.ok && detection.platform ? (
          <p className="text-sm text-rl_text">
            Detected: {detection.platform} {formatHandle(detection.handle)}
            <span className="ml-2 text-xs text-rl_muted">Manual until you connect</span>
          </p>
        ) : null}
        {detection && !detection.ok && identityInput.trim() ? (
          <p className="text-sm text-rl_warning">{detection.error}</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="acc-platform" label="Platform" error={errors.platform}>
            <select
              id="acc-platform"
              className={fieldClass}
              value={draft.platform}
              onChange={(e) => {
                const platform = e.target.value;
                setDraft({ ...draft, platform });
                if (identityInput) applyIdentity(identityInput);
              }}
            >
              {PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </FormField>
          <FormField id="acc-name" label="Display name" error={errors.displayName}>
            <input id="acc-name" className={fieldClass} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
          </FormField>
          <FormField id="acc-handle" label="Handle">
            <input id="acc-handle" className={fieldClass} placeholder="@you" value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })} />
          </FormField>
        </div>
        <p className="rl-meta">
          Connection: {displayConnectionState(draft, { providerReadiness: readinessFor(draft.platform) }).label}. {softCapabilityLine(draft.platform)} URL detection never marks an account Connected.
        </p>
        <div className="flex items-center justify-between rounded-xl border border-rl_border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-rl_text">Active account</p>
            <p className="rl-meta">Inactive accounts stay in the registry.</p>
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, active: !draft.active })}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
              draft.active ? "bg-rl_ok text-white" : "border border-rl_border text-rl_muted"
            }`}
            aria-pressed={draft.active}
          >
            {draft.active ? "Active" : "Inactive"}
          </button>
        </div>
        <details className="rounded-xl border border-rl_border px-4 py-3">
          <summary className="cursor-pointer rl-label">
            More details
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FormField id="acc-url" label="Profile URL" error={errors.profileUrl}>
              <input id="acc-url" className={fieldClass} placeholder="https://" value={draft.profileUrl} onChange={(e) => setDraft({ ...draft, profileUrl: e.target.value })} />
            </FormField>
            <FormField id="acc-purpose" label="Account purpose">
              <input id="acc-purpose" className={fieldClass} value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
            </FormField>
            <FormField id="acc-followers" label="Follower count (manual)">
              <input id="acc-followers" className={fieldClass} value={draft.followerCount} onChange={(e) => setDraft({ ...draft, followerCount: e.target.value })} />
            </FormField>
            <FormField id="acc-provider-id" label="Provider account ID">
              <input id="acc-provider-id" className={fieldClass} value={draft.providerAccountId} onChange={(e) => setDraft({ ...draft, providerAccountId: e.target.value })} />
            </FormField>
            <FormField id="acc-permission" label="Publishing permission">
              <select id="acc-permission" className={fieldClass} value={draft.publishPermission} onChange={(e) => setDraft({ ...draft, publishPermission: e.target.value })}>
                {PUBLISH_PERMISSIONS.map((id) => (
                  <option key={id} value={id}>{PUBLISH_PERMISSION_LABELS[id]}</option>
                ))}
              </select>
            </FormField>
            <FormField id="acc-role" label="Account role">
              <input id="acc-role" className={fieldClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value, campaignRole: e.target.value })} />
            </FormField>
            <FormField id="acc-content" label="Primary content type">
              <input id="acc-content" className={fieldClass} value={draft.primaryContentType} onChange={(e) => setDraft({ ...draft, primaryContentType: e.target.value })} />
            </FormField>
            <FormField id="acc-cta" label="Default CTA">
              <input id="acc-cta" className={fieldClass} value={draft.defaultCta} onChange={(e) => setDraft({ ...draft, defaultCta: e.target.value })} />
            </FormField>
            <FormField id="acc-metrics" label="Last metrics update">
              <input id="acc-metrics" type="date" className={fieldClass} value={draft.lastMetricsUpdate} onChange={(e) => setDraft({ ...draft, lastMetricsUpdate: e.target.value })} />
            </FormField>
            <FormField id="acc-audience" label="Audience notes">
              <textarea id="acc-audience" className={fieldClass} rows={2} value={draft.audienceNotes} onChange={(e) => setDraft({ ...draft, audienceNotes: e.target.value })} />
            </FormField>
            <FormField id="acc-strengths" label="Platform strengths">
              <textarea id="acc-strengths" className={fieldClass} rows={2} value={draft.platformStrengths} onChange={(e) => setDraft({ ...draft, platformStrengths: e.target.value })} />
            </FormField>
            <FormField id="acc-weaknesses" label="Platform weaknesses">
              <textarea id="acc-weaknesses" className={fieldClass} rows={2} value={draft.platformWeaknesses} onChange={(e) => setDraft({ ...draft, platformWeaknesses: e.target.value })} />
            </FormField>
            <FormField id="acc-posting" label="Posting notes">
              <textarea id="acc-posting" className={fieldClass} rows={2} value={draft.postingNotes} onChange={(e) => setDraft({ ...draft, postingNotes: e.target.value })} />
            </FormField>
            <div className="md:col-span-2">
              <FormField id="acc-notes" label="Notes">
                <textarea id="acc-notes" className={fieldClass} rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </FormField>
            </div>
          </div>
        </details>
        <button type="submit" className="rl-btn">
          {editingId ? "Update account" : "Add account"}
        </button>
      </form>

      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet" body="Add the real profiles you publish from." />
      ) : (
        <ul className="divide-y divide-rl_border border-y border-rl_border">
          {accounts.map((account) => {
            const usedBy = campaigns.filter((campaign) => (campaign.accountIds || []).includes(account.id)).length;
            const view = displayConnectionState(account, { providerReadiness: readinessFor(account.platform) });
            const health = HEALTH[view.code] || HEALTH.MANUAL_ONLY;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(account.id)}
                  className="flex w-full flex-col gap-2 py-3.5 text-left transition-colors hover:bg-rl_surfaceSoft/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-rl_text">
                        {account.platform}
                      </h2>
                      <StatusBadge value={view.code} label={health.label} tone={health.tone} />
                    </div>
                    <p className="mt-1 text-sm text-rl_text">
                      {formatHandle(account.handle) || account.displayName || "No handle"}
                    </p>
                    <p className="mt-0.5 text-sm text-rl_muted">
                      {view.hint}
                      {view.code === "CONNECTED" && (account.lastSuccessfulSync || account.lastSync)
                        ? ` · Last synced ${formatStamp(account.lastSuccessfulSync || account.lastSync)}`
                        : ""}
                      {` · ${usedBy} campaign${usedBy === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-rl_muted">Manage</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AccountDetailSheet
        account={selected}
        campaigns={campaigns}
        content={content}
        busy={busyId === selected?.id}
        onClose={() => setSelectedId(null)}
        onEdit={startEdit}
        onDelete={setPendingDelete}
        onToggleActive={(account) => updateAccount(account.id, { active: account.active === false })}
        onConnect={runConnect}
        onReconnect={runConnect}
        onRefresh={runRefresh}
        onDisconnect={runDisconnect}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this account?"
        body="Campaigns that referenced it will keep the id but show it as removed. This does not log into any platform."
        confirmLabel="Delete account"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          deleteAccount(pendingDelete.id);
          setPendingDelete(null);
          setSelectedId(null);
        }}
      />
    </PageShell>
  );
}

function AccountDetailSheet({
  account,
  campaigns,
  content,
  busy,
  onClose,
  onEdit,
  onDelete,
  onToggleActive,
  onConnect,
  onReconnect,
  onRefresh,
  onDisconnect,
}) {
  if (!account) return null;

  const connection = account.connectionState || "MANUAL_ONLY";
  const health = healthFor(connection);
  const needsReconnect = ["ERROR", "AUTH_EXPIRED", "RECONNECT_REQUIRED"].includes(connection);
  const canConnect = !["CONNECTED", "UNSUPPORTED"].includes(connection);
  const media = publishMediaSupport(account.platform);
  const usedCampaigns = campaigns.filter((campaign) => (campaign.accountIds || []).includes(account.id));
  const recentPosts = content
    .filter((item) => (item.accountIds || []).includes(account.id) && ["SCHEDULED", "PUBLISHED", "READY", "FAILED"].includes(item.status))
    .sort((a, b) => String(b.publishedAt || b.scheduledAt || b.updatedAt).localeCompare(String(a.publishedAt || a.scheduledAt || a.updatedAt)))
    .slice(0, 5);

  return (
    <SideSheet
      open={Boolean(account)}
      onClose={onClose}
      title={account.displayName || account.handle || "Account"}
      subtitle={`${account.platform} · ${account.handle || "no handle"}`}
      width="md"
      footer={(
        <div className="flex flex-wrap gap-2">
          {canConnect && (
            <button type="button" className="rl-btn" disabled={busy} onClick={() => onConnect(account)}>
              {busy ? "Working…" : connection === "SETUP_REQUIRED" ? "Retry setup" : `Connect ${account.platform}`}
            </button>
          )}
          {needsReconnect && (
            <button type="button" className="rl-btn" disabled={busy} onClick={() => onReconnect(account)}>
              Reconnect
            </button>
          )}
          {connection === "CONNECTED" && (
            <>
              <button type="button" className="rl-btn-ghost" disabled={busy} onClick={() => onRefresh(account)}>
                Refresh
              </button>
              <button type="button" className="rl-btn-ghost" disabled={busy} onClick={() => onDisconnect(account)}>
                Disconnect
              </button>
              <Link to="/analytics" className="rl-btn-ghost" onClick={onClose}>Open analytics</Link>
            </>
          )}
          <button type="button" className="rl-btn-ghost" onClick={() => onEdit(account)}>Edit</button>
          <button type="button" className="rl-btn-ghost" onClick={() => onToggleActive(account)}>
            {account.active === false ? "Activate" : "Deactivate"}
          </button>
          <button type="button" className="text-xs uppercase tracking-[0.12em] text-rl_danger" onClick={() => onDelete(account)}>
            Delete
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div>
          <p className="rl-label">Connection</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={connection} label={health.label} tone={health.tone} />
          </div>
          <p className="mt-2 text-sm text-rl_textSecondary">{softCapabilityLine(account.platform)}</p>
          <p className="mt-1 text-sm text-rl_muted">
            Last sync: {account.lastSuccessfulSync || account.lastSync ? formatStamp(account.lastSuccessfulSync || account.lastSync) : "—"}
            {" · "}
            Analytics: {account.analyticsFreshness ? formatStamp(account.analyticsFreshness) : "—"}
          </p>
          <p className="mt-1 text-sm text-rl_muted">
            Publishing: {PUBLISH_PERMISSION_LABELS[account.publishPermission] || account.publishPermission}
            {" · "}
            Analytics: {connection === "CONNECTED" ? "Available when provider permits" : "Manual / unavailable"}
          </p>
          {(account.lastErrorSummary || account.connectionError) && (
            <p className="mt-2 text-sm text-rl_danger">{account.lastErrorSummary || account.connectionError}</p>
          )}
          {needsReconnect && (
            <p className="mt-2 text-sm text-rl_danger">
              {account.platform} needs to be reconnected.
            </p>
          )}
        </div>

        <div>
          <p className="rl-label">Publish capabilities</p>
          <ul className="mt-2 space-y-1 text-sm text-rl_textSecondary">
            <li>Image {media.image ? "✓" : "✕"}</li>
            <li>Video / Reel {media.video ? "✓" : "✕"}</li>
            <li>Text-only {media.text ? "✓" : "✕"}</li>
            <li>Schedule {media.schedule ? "✓" : "✕"}</li>
          </ul>
        </div>

        <div>
          <p className="rl-label">Campaigns</p>
          <p className="mt-2 text-sm text-rl_text">
            {usedCampaigns.length} campaign{usedCampaigns.length === 1 ? "" : "s"}
          </p>
          {usedCampaigns.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-rl_textSecondary">
              {usedCampaigns.slice(0, 5).map((campaign) => (
                <li key={campaign.id}>
                  <Link to={`/campaigns/${campaign.id}`} className="hover:underline" onClick={onClose}>
                    {campaign.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="rl-label">Recent posting</p>
          {recentPosts.length === 0 ? (
            <p className="mt-2 text-sm text-rl_muted">No scheduled or published posts yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {recentPosts.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <Link to={`/content/${item.id}`} className="hover:underline" onClick={onClose}>
                    {item.title || "Untitled"}
                  </Link>
                  <span className="shrink-0 text-xs text-rl_muted">
                    {item.status} · {formatStamp(item.publishedAt || item.scheduledAt || item.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {account.profileUrl && (
          <a
            href={account.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs text-rl_muted underline underline-offset-4"
          >
            Open profile
          </a>
        )}
      </div>
    </SideSheet>
  );
}
