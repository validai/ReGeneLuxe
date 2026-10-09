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
import {
  publishMediaSupport,
  startProviderConnect,
  connectionAction,
  refreshAccountAnalytics,
} from "../data/connectors/registry.js";
import { formatStamp } from "../utils/dates.js";
import { useToast } from "../components/app/useToast.js";
import { parseSocialIdentity } from "../data/socialAccountUrl.js";
import { displayConnectionState, formatHandle } from "../data/connectionStatus.js";
import { fieldsForPlatform, identityHintForPlatform } from "../data/socialAccountFields.js";
import { PlatformIcon } from "../components/app/Icon.jsx";
import { useProfileSession } from "../components/app/ProfileSession.jsx";

const blank = () => emptyAccount({
  platform: "Instagram",
  displayName: "",
  handle: "",
  profileUrl: "",
  active: true,
});

function capabilityBits(platform) {
  const media = publishMediaSupport(platform);
  return [
    media.image ? "Image" : null,
    media.video ? "Video" : null,
    media.text ? "Text" : null,
  ].filter(Boolean);
}

function providerSlug(platform) {
  return String(platform || "").toLowerCase().replace("twitter", "x");
}

function safeIdentityPatch(draft) {
  return {
    displayName: draft.displayName,
    handle: draft.handle,
    profileUrl: draft.profileUrl,
    platform: draft.platform,
  };
}

export default function AccountsPage() {
  const { accounts, campaigns, content } = useAppData();
  const { activeProfile } = useProfileSession();
  const toast = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState(blank());
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [setupMessage, setSetupMessage] = useState("");
  const [identityInput, setIdentityInput] = useState("");
  const [detection, setDetection] = useState(null);
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
  const [providers, setProviders] = useState([]);

  const selected = accounts.find((account) => account.id === selectedId) || null;
  const brandName = activeProfile?.displayName || "this workspace";
  const composerFields = fieldsForPlatform(draft.platform);

  const readinessFor = (platform) => {
    const id = String(platform || "").toLowerCase().replace("twitter", "x");
    return providers.find((item) => item.provider === id || item.displayName === platform)?.readiness || "";
  };

  const applyIdentity = (value, platform = draft.platform, { preferPlatform = false } = {}) => {
    setIdentityInput(value);
    const looksUrl = /[./]/.test(value) && !value.trim().startsWith("@");
    const parsed = parseSocialIdentity(value, looksUrl && !preferPlatform ? {} : { platform });
    setDetection(parsed);
    if (!parsed.ok) {
      if (preferPlatform) setDraft((current) => ({ ...current, platform }));
      return;
    }
    setDraft((current) => ({
      ...current,
      platform: preferPlatform ? platform : (parsed.platform || current.platform),
      handle: parsed.handle ? `@${String(parsed.handle).replace(/^@/, "")}` : current.handle,
      profileUrl: parsed.profileUrl || current.profileUrl,
      displayName: displayNameEdited ? current.displayName : (parsed.displayName || ""),
      connectionState: current.connectionState || "MANUAL_ONLY",
      connectionMethod: current.connectionMethod || "MANUAL",
    }));
  };

  useEffect(() => {
    setHydrated(true);
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
    if (!data.displayName.trim() && !data.handle.trim() && !data.profileUrl.trim()) {
      next.displayName = "Add a display name, handle, or profile URL.";
    }
    return next;
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    setDraft(blank());
    setIdentityInput("");
    setDetection(null);
    setDisplayNameEdited(false);
    setErrors({});
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    if (editingId) {
      updateAccount(editingId, safeIdentityPatch(draft));
    } else {
      createAccount({
        ...safeIdentityPatch(draft),
        connectionState: "MANUAL_ONLY",
        connectionMethod: "MANUAL",
      });
    }
    closeComposer();
  };

  const startAdd = () => {
    setEditingId(null);
    setDraft(blank());
    setIdentityInput("");
    setDetection(null);
    setDisplayNameEdited(false);
    setErrors({});
    setSelectedId(null);
    setComposerOpen(true);
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setDraft({ ...account });
    setIdentityInput(account.profileUrl || account.handle || "");
    setDisplayNameEdited(Boolean(account.displayName));
    setDetection(parseSocialIdentity(account.profileUrl || account.handle || "", { platform: account.platform }));
    setErrors({});
    setSelectedId(null);
    setComposerOpen(true);
  };

  return (
    <PageShell dense>
      <PageHeader
        title="Social Accounts"
        description={`Social accounts and channels for ${brandName}. A pasted URL identifies the account. It does not connect it.`}
        actions={(
          <button type="button" className="rl-btn whitespace-nowrap" onClick={startAdd}>
            + Add social account
          </button>
        )}
      />

      {setupMessage ? (
        <div className="rounded-xl border border-rl_warning/40 bg-rl_warning/10 px-4 py-3 text-sm text-rl_text whitespace-pre-wrap">
          {setupMessage}
        </div>
      ) : null}

      {(hydrated ? accounts : []).length === 0 ? (
        <EmptyState
          title="No social accounts added yet."
          body="Add the Instagram, YouTube, or other channels this workspace publishes from. Pasting a URL never marks an account Connected."
          action={(
            <button type="button" className="rl-btn" onClick={startAdd}>
              Add social account
            </button>
          )}
        />
      ) : (
        <ul className="grid gap-4">
          {(hydrated ? accounts : []).map((account) => {
            const usedBy = campaigns.filter((campaign) => (campaign.accountIds || []).includes(account.id)).length;
            const view = displayConnectionState(account, { providerReadiness: readinessFor(account.platform) });
            const caps = capabilityBits(account.platform);
            return (
              <li key={account.id}>
                <article className="flex h-full flex-col rounded-2xl border border-rl_border bg-rl_surface p-5 shadow-rl_soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-rl_text">
                        <PlatformIcon platform={account.platform} size="sm" />
                        {account.platform}
                      </h2>
                      <p className="mt-1 truncate text-base font-medium text-rl_text">
                        {account.displayName || formatHandle(account.handle) || "Untitled account"}
                      </p>
                    </div>
                    <StatusBadge value={view.code} label={view.label} tone={view.toneClass} />
                  </div>
                  {formatHandle(account.handle) ? (
                    <p className="mt-2 text-sm text-rl_muted">{formatHandle(account.handle)}</p>
                  ) : null}
                  {account.profileUrl ? (
                    <p className="mt-1 truncate text-sm text-rl_muted">{account.profileUrl}</p>
                  ) : null}
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-rl_muted">Connection</dt>
                      <dd className="text-right text-rl_text">{view.label}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-rl_muted">Capabilities</dt>
                      <dd className="text-right text-rl_text">{caps.length ? caps.join(" · ") : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-rl_muted">Campaigns</dt>
                      <dd className="text-right text-rl_text">{usedBy}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto pt-4">
                    <button
                      type="button"
                      className="rl-btn-ghost w-full"
                      onClick={() => setSelectedId(account.id)}
                    >
                      Manage
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <SideSheet
        open={composerOpen}
        onClose={closeComposer}
        title={editingId ? "Edit social account" : "Add social account"}
        subtitle="Identifier only. This never marks the account Connected."
        width="md"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="rl-btn-ghost" onClick={closeComposer}>Cancel</button>
            <button type="submit" form="social-account-composer" className="rl-btn">
              {editingId ? "Save" : "Add social account"}
            </button>
          </div>
        )}
      >
        <form
          id="social-account-composer"
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            const tag = event.target?.tagName;
            if (event.key === "Enter" && (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")) {
              event.preventDefault();
            }
          }}
          className="space-y-4"
        >
          <FormField id="acc-platform" label="Platform" error={errors.platform}>
            <select
              id="acc-platform"
              className={fieldClass}
              value={draft.platform}
              onChange={(e) => {
                const platform = e.target.value;
                if (identityInput) applyIdentity(identityInput, platform, { preferPlatform: true });
                else setDraft({ ...draft, platform });
              }}
            >
              {PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </FormField>
          {composerFields.identity ? (
            <FormField id="acc-identity" label={identityHintForPlatform(draft.platform)}>
              <input
                id="acc-identity"
                className={fieldClass}
                placeholder={identityHintForPlatform(draft.platform)}
                value={identityInput}
                onChange={(event) => applyIdentity(event.target.value)}
              />
            </FormField>
          ) : null}
          {detection?.ok && detection.platform ? (
            <p className="text-sm text-rl_text">
              Detected: {detection.platform} {formatHandle(detection.handle)}
              <span className="ml-2 text-xs text-rl_muted">Not connected</span>
            </p>
          ) : null}
          {detection && !detection.ok && identityInput.trim() ? (
            <p className="text-sm text-rl_warning">{detection.error}</p>
          ) : null}
          {composerFields.displayName ? (
            <FormField id="acc-name" label="Display name" error={errors.displayName}>
              <input
                id="acc-name"
                className={fieldClass}
                value={draft.displayName}
                onChange={(e) => {
                  setDisplayNameEdited(true);
                  setDraft((current) => ({ ...current, displayName: e.target.value }));
                }}
              />
            </FormField>
          ) : null}
          {composerFields.handle ? (
            <FormField id="acc-handle" label="Handle">
              <input id="acc-handle" className={fieldClass} placeholder="@you" value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })} />
            </FormField>
          ) : null}
          {composerFields.profileUrl ? (
            <FormField id="acc-url" label="Profile URL">
              <input id="acc-url" className={fieldClass} placeholder="https://" value={draft.profileUrl} onChange={(e) => setDraft({ ...draft, profileUrl: e.target.value })} />
            </FormField>
          ) : null}
          {composerFields.note ? <p className="text-sm text-rl_muted">{composerFields.note}</p> : null}
        </form>
      </SideSheet>

      <AccountDetailSheet
        account={selected}
        campaigns={campaigns}
        content={content}
        busy={busyId === selected?.id}
        providerReadiness={selected ? readinessFor(selected.platform) : ""}
        onClose={() => setSelectedId(null)}
        onEdit={startEdit}
        onDelete={setPendingDelete}
        onToggleActive={(account) => updateAccount(account.id, { active: account.active === false })}
        onSaveIdentity={(account, patch) => updateAccount(account.id, safeIdentityPatch(patch))}
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
  providerReadiness = "",
  onClose,
  onEdit,
  onDelete,
  onToggleActive,
  onSaveIdentity,
  onConnect,
  onReconnect,
  onRefresh,
  onDisconnect,
}) {
  if (!account) return null;
  return (
    <AccountDetailSheetBody
      key={account.id}
      account={account}
      campaigns={campaigns}
      content={content}
      busy={busy}
      providerReadiness={providerReadiness}
      onClose={onClose}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleActive={onToggleActive}
      onSaveIdentity={onSaveIdentity}
      onConnect={onConnect}
      onReconnect={onReconnect}
      onRefresh={onRefresh}
      onDisconnect={onDisconnect}
    />
  );
}

function AccountDetailSheetBody({
  account,
  campaigns,
  content,
  busy,
  providerReadiness = "",
  onClose,
  onEdit,
  onDelete,
  onToggleActive,
  onSaveIdentity,
  onConnect,
  onReconnect,
  onRefresh,
  onDisconnect,
}) {
  const [name, setName] = useState(account.displayName || "");
  const [handle, setHandle] = useState(account.handle || "");
  const [url, setUrl] = useState(account.profileUrl || "");

  const view = displayConnectionState(account, { providerReadiness });
  const needsReconnect = ["ERROR", "AUTH_EXPIRED", "RECONNECT_REQUIRED"].includes(view.code);
  const canConnect = view.code !== "CONNECTED"
    && view.code !== "UNSUPPORTED"
    && providerReadiness !== "UNSUPPORTED";
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
              {busy ? "Working…" : view.code === "SETUP_REQUIRED" ? "Retry setup" : `Connect ${account.platform}`}
            </button>
          )}
          {needsReconnect && (
            <button type="button" className="rl-btn" disabled={busy} onClick={() => onReconnect(account)}>
              Reconnect
            </button>
          )}
          {view.code === "CONNECTED" && (
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
          <button type="button" className="rl-btn-ghost" onClick={() => onEdit(account)}>Edit identifiers</button>
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
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveIdentity(account, { ...account, displayName: name, handle, profileUrl: url });
          }}
        >
          <p className="rl-label">Identifiers</p>
          <FormField id="manage-name" label="Display name">
            <input id="manage-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="manage-handle" label="Handle">
            <input id="manage-handle" className={fieldClass} value={handle} onChange={(e) => setHandle(e.target.value)} />
          </FormField>
          <FormField id="manage-url" label="Profile URL">
            <input id="manage-url" className={fieldClass} value={url} onChange={(e) => setUrl(e.target.value)} />
          </FormField>
          <button type="submit" className="rl-btn-ghost">Save identifiers</button>
          <p className="text-xs text-rl_muted">
            Connection identity, provider account ID, tokens, and workspace ownership cannot be edited here.
          </p>
        </form>

        <div>
          <p className="rl-label">Connection</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={view.code} label={view.label} tone={view.toneClass} />
          </div>
          <p className="mt-2 text-sm text-rl_textSecondary">{view.hint}</p>
          <p className="mt-1 text-sm text-rl_muted">
            Last sync: {account.lastSuccessfulSync || account.lastSync ? formatStamp(account.lastSuccessfulSync || account.lastSync) : "—"}
          </p>
          {(account.lastErrorSummary || account.connectionError) && (
            <p className="mt-2 text-sm text-rl_danger">{account.lastErrorSummary || account.connectionError}</p>
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
      </div>
    </SideSheet>
  );
}
