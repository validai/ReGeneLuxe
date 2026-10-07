"use client";

import { useEffect, useState } from "react";
import { Link } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import ConfirmDialog from "../components/app/ConfirmDialog.jsx";
import ChoiceChip from "../components/choices/ChoiceChip.jsx";
import Skeleton from "../components/app/Skeleton.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { SCHEMA_VERSION, PLATFORMS, SOCIAL_CONNECTION_PLATFORMS } from "../data/models.js";
import { AI_MODES, AI_MODE_LABELS } from "../data/domain.js";
import { updateSettings, resetAllLocalData } from "../data/settingsRepository.js";
import { downloadBackupFile, importBackup, validateBackup } from "../data/backupService.js";
import { getRuntimeStatus, getRuntimeHealth, saveRuntimeSecret } from "../data/runtimeClient.js";
import { fetchDbHealth, getLastDbHealth } from "../data/durableBootstrap.js";
import { useProfileSession } from "../components/app/ProfileSession.jsx";
import { displayConnectionState, displayProfileConnection, formatHandle } from "../data/connectionStatus.js";
import { displayAccountEmail } from "../data/googleIdentity.js";
import { formatDataSyncDisplay, formatSyncLine, mergeHealthWithSyncStatus } from "../data/syncHealth.js";
import StatusBadge from "../components/app/StatusBadge.jsx";
import { PlatformIcon } from "../components/app/Icon.jsx";

const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
];

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function explainRuntime(runtime) {
  if (!runtime.running) return runtime.error || "Local runtime is unavailable.";
  if (runtime.aiConfigured) return "Local runtime is running with an AI provider configured.";
  return "Local runtime is running. AI is not configured yet.";
}

/**
 * @param {{ initialDbHealth?: object | null }} [props]
 */
export default function SettingsPage({ initialDbHealth = null } = {}) {
  const { settings, campaigns, accounts } = useAppData();
  const { operator, activeProfile, connections, refresh } = useProfileSession();
  const [providers, setProviders] = useState([]);
  const [importError, setImportError] = useState("");
  const [importOk, setImportOk] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [runtime, setRuntime] = useState({ running: false, aiConfigured: false, state: "UNAVAILABLE" });
  const [health, setHealth] = useState(null);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [runtimeNote, setRuntimeNote] = useState("");

  const [dbHealth, setDbHealth] = useState(() => initialDbHealth || getLastDbHealth());
  const [connectionNote, setConnectionNote] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    const youtube = params.get("youtube");
    if (gmail === "connected") return "Gmail connected for this account.";
    if (gmail === "error") return params.get("message") || "Gmail connection failed.";
    if (youtube === "connected") return "YouTube connected for this account.";
    if (youtube === "pick") return "Choose a YouTube channel for this account.";
    if (youtube === "error") return params.get("message") || "YouTube connection failed.";
    return "";
  });
  const gmailConnection = connections?.gmail || { status: "NOT_CONNECTED" };
  const youtubeConnection = connections?.youtube || { status: "NOT_CONNECTED" };
  const gmailView = displayProfileConnection(gmailConnection);
  const youtubeView = displayProfileConnection(youtubeConnection);
  const operatorEmail = displayAccountEmail(operator);
  const dataSync = formatDataSyncDisplay(dbHealth);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    const youtube = params.get("youtube");
    if (gmail === "connected" || youtube === "connected" || youtube === "pick") refresh?.();
    const hash = window.location.hash;
    if (hash || gmail || youtube) {
      document.querySelector(hash || "#connections")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    fetchDbHealth()
      .then((nextDb) => {
        if (!cancelled) setDbHealth(nextDb);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Health request failed";
        setDbHealth({
          ok: false,
          fetchFailed: true,
          error: message,
          local: { healthy: null, error: message },
          sync: { cloudConfigured: null, state: "UNKNOWN", error: message, pendingOutbox: null },
        });
      });
    Promise.all([
      getRuntimeStatus(),
      getRuntimeHealth(),
      fetch("/api/connections", { credentials: "same-origin" }).then((res) => res.json()).catch(() => ({})),
    ])
      .then(([status, nextHealth, connectionBody]) => {
        if (cancelled) return;
        setRuntime(status);
        setHealth(nextHealth);
        if (Array.isArray(connectionBody?.providers)) setProviders(connectionBody.providers);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRuntimeLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const togglePlatform = (platform) => {
    const current = new Set(settings.defaultPlatforms || []);
    if (current.has(platform)) current.delete(platform);
    else current.add(platform);
    updateSettings({ defaultPlatforms: [...current] });
  };

  const handleImport = async (event) => {
    setImportError("");
    setImportOk("");
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportError("That file is not valid JSON.");
        return;
      }

      const check = validateBackup(parsed);
      if (!check.ok) {
        setImportError(check.error);
        return;
      }

      const result = importBackup(parsed);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setImportOk(`Imported ${result.imported.campaigns} campaigns and ${result.imported.accounts} accounts.`);
    } catch (error) {
      setImportError(error?.message || "Import failed.");
    }
  };

  return (
    <PageShell width="narrow" className="space-y-8">
      <PageHeader
        title="Settings"
        description="Account, connections, and local data."
      />

      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Settings sections">
        {[
          ["#account", "Account"],
          ["#connections", "Connections"],
          ["#data", "Data & Sync"],
          ["#preferences", "Preferences"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-rl_border px-3 py-1.5 text-rl_muted hover:text-rl_text">
            {label}
          </a>
        ))}
      </nav>

      <section id="account" className="rl-panel space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {activeProfile?.avatarUrl ? (
              <img src={activeProfile.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rl_surfaceActive text-sm font-semibold">
                {(activeProfile?.displayName || operatorEmail || "?").slice(0, 1)}
              </span>
            )}
            <div>
              <h2 className="text-sm font-semibold text-rl_text">{activeProfile?.displayName || "Account"}</h2>
              <p className="text-xs text-rl_muted">Signed in with Google</p>
            </div>
          </div>
          {activeProfile ? (
            <div className="flex flex-wrap gap-2">
              <Link to="/settings/profile" className="rl-btn-ghost px-3 py-1.5 text-xs">Edit account</Link>
              <Link to="/settings/profile" className="rl-btn-ghost px-3 py-1.5 text-xs">Change image</Link>
            </div>
          ) : null}
        </div>
        <ul className="space-y-1 text-sm text-rl_muted">
          <li>Email · {operatorEmail || "Not signed in"}</li>
          <li>Primary public link · {activeProfile?.primaryPublicUrl || "—"}</li>
          <li>Website · {activeProfile?.website || "—"}</li>
          <li>Timezone · {activeProfile?.timezone || "—"}</li>
          <li>Description · {activeProfile?.shortDescription || "—"}</li>
          <li>Main platforms · {(activeProfile?.platforms || []).join(", ") || "—"}</li>
        </ul>
      </section>

      <section id="connections" className="rl-panel space-y-4 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Connections</h2>
        <p className="text-sm text-rl_muted">
          Gmail and YouTube add permission for the same Google account that is signed in. Brand channels stay selectable under that account.
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border border-rl_border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-rl_text">Gmail</p>
                <p className="truncate text-xs text-rl_muted">
                  {gmailView.code === "CONNECTED"
                    ? `Authorized account: ${gmailConnection.email || gmailConnection.externalEmail || "Connected"}`
                    : gmailView.hint}
                </p>
              </div>
              <StatusBadge value={gmailView.code} label={gmailView.label} />
            </div>
            {gmailView.code === "CONNECTED" ? (
              <ul className="mt-2 space-y-1 text-xs text-rl_muted">
                <li>Permission: Read only</li>
                <li>Last sync: {formatWhen(gmailConnection.lastSuccessfulSyncAt || gmailConnection.lastSyncAt)}</li>
                <li>Messages indexed: {gmailConnection.indexedCount ?? 0}</li>
              </ul>
            ) : null}
            {gmailConnection.lastErrorSummary && gmailView.code !== "CONNECTED" ? (
              <p className="mt-2 text-xs text-rl_warning">{gmailConnection.lastErrorSummary}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {gmailView.code === "CONNECTED" ? (
                <>
                  <button
                    type="button"
                    className="rl-btn-ghost px-3 py-1.5 text-xs"
                    onClick={async () => {
                      const result = await fetch("/api/connections/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind: "GMAIL", action: "sync" }),
                      }).then((response) => response.json()).catch(() => ({}));
                      if (result.ok) {
                        setConnectionNote("Gmail sync finished.");
                        await refresh?.();
                      } else {
                        setConnectionNote(result.error || "Gmail needs to be reconnected.");
                        await refresh?.();
                      }
                    }}
                  >
                    Sync now
                  </button>
                  <a href="/api/oauth/gmail/start" className="rl-btn-ghost px-3 py-1.5 text-xs">Reconnect</a>
                  <button
                    type="button"
                    className="rl-btn-ghost px-3 py-1.5 text-xs"
                    onClick={async () => {
                      const result = await fetch("/api/connections/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind: "GMAIL", action: "disconnect" }),
                      }).then((response) => response.json()).catch(() => ({}));
                      if (result.ok) {
                        setConnectionNote("Gmail disconnected. This account was kept.");
                        await refresh?.();
                      } else {
                        setConnectionNote(result.error || "Could not disconnect Gmail.");
                      }
                    }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <>
                  <a href="/api/oauth/gmail/start" className="rl-btn-ghost px-3 py-1.5 text-xs">
                    {gmailView.code === "NOT_CONNECTED" ? "Connect Gmail" : "Reconnect Gmail"}
                  </a>
                  {gmailView.code !== "NOT_CONNECTED" ? (
                    <button
                      type="button"
                      className="rl-btn-ghost px-3 py-1.5 text-xs"
                      onClick={async () => {
                        const result = await fetch("/api/connections/google", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ kind: "GMAIL", action: "disconnect" }),
                        }).then((response) => response.json()).catch(() => ({}));
                        if (result.ok) {
                          setConnectionNote("Gmail disconnected. This account was kept.");
                          await refresh?.();
                        } else {
                          setConnectionNote(result.error || "Could not disconnect Gmail.");
                        }
                      }}
                    >
                      Disconnect
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-rl_border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-rl_text">YouTube</p>
                <p className="truncate text-xs text-rl_muted">
                  {youtubeView.code === "CONNECTED" && youtubeConnection.channelTitle
                    ? youtubeConnection.channelTitle
                    : youtubeView.hint}
                </p>
              </div>
              <StatusBadge value={youtubeView.code} label={youtubeView.label} />
            </div>
            {youtubeView.code === "CONNECTED" && youtubeConnection.channelId ? (
              <ul className="mt-2 space-y-1 text-xs text-rl_muted">
                <li>Authorized account: {youtubeConnection.email || youtubeConnection.externalEmail || "—"}</li>
                <li>Permission: Read only</li>
                <li>Channel ID: {youtubeConnection.channelId}</li>
                <li>Last sync: {formatWhen(youtubeConnection.lastSuccessfulSyncAt || youtubeConnection.lastSyncAt)}</li>
              </ul>
            ) : null}
            {youtubeConnection.lastErrorSummary && youtubeView.code !== "CONNECTED" ? (
              <p className="mt-2 text-xs text-rl_warning">{youtubeConnection.lastErrorSummary}</p>
            ) : null}
            {(youtubeConnection.pendingChannels || []).length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-rl_muted">Select a YouTube channel for this profile.</p>
                {youtubeConnection.pendingChannels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-rl_border px-3 py-2 text-left"
                    onClick={async () => {
                      const result = await fetch("/api/connections/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind: "YOUTUBE", action: "select", channelId: channel.id }),
                      }).then((response) => response.json()).catch(() => ({}));
                      if (result.ok) {
                        setConnectionNote(`${channel.title || "YouTube channel"} selected.`);
                        await refresh?.();
                      } else {
                        setConnectionNote(result.error || "Could not select that channel.");
                      }
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-rl_text">{channel.title || channel.id}</span>
                      <span className="block truncate text-xs text-rl_muted">
                        {[channel.handle, channel.id, channel.subscriberCount != null ? `${channel.subscriberCount} subscribers` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {youtubeView.code === "CONNECTED" && youtubeConnection.channelId ? (
                <>
                  <button
                    type="button"
                    className="rl-btn-ghost px-3 py-1.5 text-xs"
                    onClick={async () => {
                      const result = await fetch("/api/connections/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind: "YOUTUBE", action: "sync" }),
                      }).then((response) => response.json()).catch(() => ({}));
                      if (result.ok) {
                        setConnectionNote("YouTube sync finished.");
                        await refresh?.();
                      } else {
                        setConnectionNote(result.error || "YouTube needs to be reconnected.");
                        await refresh?.();
                      }
                    }}
                  >
                    Sync now
                  </button>
                  <a href="/api/oauth/youtube/start" className="rl-btn-ghost px-3 py-1.5 text-xs">Reconnect</a>
                  <button
                    type="button"
                    className="rl-btn-ghost px-3 py-1.5 text-xs"
                    onClick={async () => {
                      const result = await fetch("/api/connections/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind: "YOUTUBE", action: "disconnect" }),
                      }).then((response) => response.json()).catch(() => ({}));
                      if (result.ok) {
                        setConnectionNote("YouTube disconnected. This account was kept.");
                        await refresh?.();
                      } else {
                        setConnectionNote(result.error || "Could not disconnect YouTube.");
                      }
                    }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <>
                  <a href="/api/oauth/youtube/start" className="rl-btn-ghost px-3 py-1.5 text-xs">
                    {youtubeView.code === "NOT_CONNECTED" ? "Connect YouTube" : "Reconnect YouTube"}
                  </a>
                  {youtubeView.code !== "NOT_CONNECTED" ? (
                    <button
                      type="button"
                      className="rl-btn-ghost px-3 py-1.5 text-xs"
                      onClick={async () => {
                        const result = await fetch("/api/connections/google", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ kind: "YOUTUBE", action: "disconnect" }),
                        }).then((response) => response.json()).catch(() => ({}));
                        if (result.ok) {
                          setConnectionNote("YouTube disconnected. This account was kept.");
                          await refresh?.();
                        } else {
                          setConnectionNote(result.error || "Could not disconnect YouTube.");
                        }
                      }}
                    >
                      Disconnect
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {SOCIAL_CONNECTION_PLATFORMS.map((platform) => {
            const account = accounts.find((item) => item.platform === platform);
            const provider = providers.find((item) => (
              item.displayName === platform || item.provider === platform.toLowerCase()
            ));
            const view = displayConnectionState(
              account || { connectionState: provider?.readiness === "UNSUPPORTED" ? "UNSUPPORTED" : "UNCONNECTED" },
              { providerReadiness: provider?.readiness || "" },
            );
            return (
              <div key={platform} className="flex items-center justify-between gap-3 rounded-lg border border-rl_border px-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-rl_text">
                    <PlatformIcon platform={platform} size="sm" />
                    {platform}
                  </p>
                  <p className="truncate text-xs text-rl_muted">
                    {account ? `${formatHandle(account.handle) || account.displayName} · ${view.hint}` : view.hint}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={view.code} label={view.label} />
                  <Link to={account ? "/accounts" : "/accounts"} className="rl-btn-ghost px-3 py-1.5 text-xs">
                    {account ? "Manage" : "Add"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        {connectionNote ? <p className="text-xs text-rl_muted">{connectionNote}</p> : null}
      </section>

      <section id="preferences" className="rl-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Preferences</h2>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-rl_muted">Theme</h3>
        <p className="text-sm text-rl_muted">Dark is the designed workspace. Light and system are optional.</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((theme) => (
            <ChoiceChip
              key={theme.id}
              label={theme.label}
              selected={(settings.theme || "dark") === theme.id}
              onClick={() => updateSettings({ theme: theme.id })}
            />
          ))}
        </div>
      </section>

      <section className="rl-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Local services</h2>
        {runtimeLoading ? (
          <Skeleton lines={4} />
        ) : (
          <>
            <ul className="space-y-2 text-sm text-rl_muted">
              <li>UI · running in this browser</li>
              <li>
                Local runtime ·{" "}
                {runtime.running
                  ? (runtime.aiConfigured ? "running" : "running · AI not configured")
                  : (runtime.error || "unavailable")}
              </li>
              <li>
                AI provider ·{" "}
                {runtime.aiConfigured ? (runtime.provider || health?.provider || "configured") : "not configured"}
              </li>
              <li>
                Social connections ·{" "}
                {(health?.connectedProviders || runtime.connectedProviders || []).length
                  ? (health?.connectedProviders || runtime.connectedProviders).join(", ")
                  : "none configured on the local runtime"}
              </li>
            </ul>
            {runtime.state === "UNAVAILABLE" && (
              <p className="text-xs text-rl_danger">
                {runtime.error || "ReGeneLuxe's local service is unavailable."} Start with `npm run dev` from regeneluxe-web.
              </p>
            )}
          </>
        )}
      </section>

      <section className="rl-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Campaign Brain</h2>
        <p className="text-sm text-rl_muted">
          {explainRuntime(runtime)}
        </p>
        <div className="flex flex-wrap gap-2">
          {AI_MODES.map((id) => (
            <ChoiceChip
              key={id}
              label={AI_MODE_LABELS[id]}
              selected={(settings.aiMode || "ASSISTED") === id}
              onClick={() => updateSettings({ aiMode: id })}
            />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField id="ai-provider" label="Provider">
            <select id="ai-provider" className={fieldClass} value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </FormField>
          <FormField id="ai-key" label="API key">
            <input id="ai-key" type="password" className={fieldClass} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Stored only on the local runtime" />
          </FormField>
        </div>
        <button
          type="button"
          className="rl-btn-ghost"
          onClick={async () => {
            const result = await saveRuntimeSecret("ai", apiKey, { provider });
            setApiKey("");
            setRuntimeNote(result.ok ? "Key stored on the local runtime. It is not in this browser backup." : (result.error || "Runtime is unavailable."));
            const next = await getRuntimeStatus();
            setRuntime(next);
            setHealth(await getRuntimeHealth());
          }}
        >
          Store key on local runtime
        </button>
        {runtimeNote && <p className="text-xs text-rl_muted">{runtimeNote}</p>}
      </section>

      <section id="data" className="rl-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Data &amp; Sync</h2>
        <p className="text-sm text-rl_muted">
          Schema version {SCHEMA_VERSION}. {campaigns.length} campaigns, {accounts.length} accounts.
          Local SQLite is the operational source of truth.
        </p>
        <ul className="space-y-2 text-sm text-rl_muted">
          <li>Account · {activeProfile?.displayName || operatorEmail || "Not signed in"}</li>
          <li>
            Gmail ·{" "}
            {gmailView.code === "CONNECTED"
              ? `Connected · last sync ${formatWhen(gmailConnection.lastSuccessfulSyncAt || gmailConnection.lastSyncAt)}`
              : gmailView.label}
          </li>
          <li>
            YouTube ·{" "}
            {youtubeView.code === "CONNECTED"
              ? `Connected · last sync ${formatWhen(youtubeConnection.lastSuccessfulSyncAt || youtubeConnection.lastSyncAt)}`
              : youtubeView.label}
          </li>
          <li>
            Local database · {formatSyncLine(dataSync.local)}
          </li>
          <li>
            Cloud database · {formatSyncLine(dataSync.cloud)}
          </li>
          <li>
            Cloud sync · {formatSyncLine(dataSync.sync)}
          </li>
          <li>
            Last sync · {formatSyncLine(dataSync.lastSync)}
          </li>
          <li>
            Pending operations · {formatSyncLine(dataSync.pending)}
          </li>
        </ul>
        <button
          type="button"
          className="rl-btn-ghost"
          onClick={async () => {
            const response = await fetch("/api/sync", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pull: true, push: true }),
            }).catch(() => null);
            const body = await response?.json?.().catch(() => null);
            const health = await fetchDbHealth();
            setDbHealth(mergeHealthWithSyncStatus(health, body?.status));
          }}
        >
          Sync now
        </button>
        <p className="text-xs text-rl_muted">
          The app works offline. Cloud sync is optional. API keys and OAuth tokens stay on the local runtime and are never synced.
        </p>
      </section>

      <section className="rl-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Default platforms</h2>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => {
            const selected = (settings.defaultPlatforms || []).includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  selected ? "border-rl_accent bg-rl_accent/10 text-rl_text" : "border-rl_border text-rl_muted"
                }`}
              >
                {platform}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rl-panel space-y-4 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Backup</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              downloadBackupFile();
              setImportOk("Backup downloaded.");
              setImportError("");
            }}
            className="rl-btn"
          >
            Export data
          </button>
          <FormField id="import-file" label="Import data">
            <input
              id="import-file"
              type="file"
              accept="application/json"
              className={fieldClass}
              onChange={handleImport}
            />
          </FormField>
        </div>
        {importError && <p className="text-sm text-rl_danger">{importError}</p>}
        {importOk && <p className="text-sm text-rl_ok">{importOk}</p>}
        <p className="text-xs text-rl_muted">
          Import replaces current local data only after the file validates.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-rl_danger/40 bg-rl_danger/10 p-5">
        <h2 className="text-sm font-semibold text-rl_danger">Reset application</h2>
        <p className="text-sm text-rl_muted">
          Deletes all local campaigns, accounts, and settings in this browser.
        </p>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="rounded-full bg-rl_danger px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
        >
          Reset local data
        </button>
      </section>

      <ConfirmDialog
        open={resetOpen}
        title="Reset all local data?"
        body="This cannot be undone unless you have an export. Export first if you need a backup."
        confirmLabel="Reset everything"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetAllLocalData();
          setResetOpen(false);
          setImportOk("Local data cleared.");
        }}
      />
    </PageShell>
  );
}
