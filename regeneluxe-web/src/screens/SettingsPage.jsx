import { useEffect, useState } from "react";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import ConfirmDialog from "../components/app/ConfirmDialog.jsx";
import ChoiceChip from "../components/choices/ChoiceChip.jsx";
import Skeleton from "../components/app/Skeleton.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { SCHEMA_VERSION, PLATFORMS } from "../data/models.js";
import { AI_MODES, AI_MODE_LABELS } from "../data/domain.js";
import { updateSettings, resetAllLocalData } from "../data/settingsRepository.js";
import { downloadBackupFile, importBackup, validateBackup } from "../data/backupService.js";
import { getRuntimeStatus, getRuntimeHealth, saveRuntimeSecret } from "../data/runtimeClient.js";
import { fetchDbHealth } from "../data/durableBootstrap.js";
import { useProfileSession } from "../components/app/ProfileSession.jsx";

const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
];

function explainRuntime(runtime) {
  if (!runtime.running) return runtime.error || "Local runtime is unavailable.";
  if (runtime.aiConfigured) return "Local runtime is running with an AI provider configured.";
  return "Local runtime is running. AI is not configured yet.";
}

export default function SettingsPage() {
  const { settings, campaigns, accounts } = useAppData();
  const { operator, activeProfile, connections } = useProfileSession();
  const [importError, setImportError] = useState("");
  const [importOk, setImportOk] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [runtime, setRuntime] = useState({ running: false, aiConfigured: false, state: "UNAVAILABLE" });
  const [health, setHealth] = useState(null);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [runtimeNote, setRuntimeNote] = useState("");

  const [dbHealth, setDbHealth] = useState(null);
  const [connectionNote, setConnectionNote] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRuntimeStatus(), getRuntimeHealth(), fetchDbHealth()])
      .then(([status, nextHealth, nextDb]) => {
        if (cancelled) return;
        setRuntime(status);
        setHealth(nextHealth);
        setDbHealth(nextDb);
      })
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
        description="Local-first durable store. Cloud sync is optional and never required to work."
      />

      {operator ? (
        <section id="account" className="rl-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-rl_text">Account &amp; Security</h2>
          <ul className="space-y-2 text-sm text-rl_muted">
            <li>Operator · Signed in with Google</li>
            <li>Name · {operator.name || "—"}</li>
            <li>Email · {operator.email || "—"}</li>
          </ul>
          <p className="text-xs text-rl_muted">
            Google sign-in does not grant Gmail or YouTube access.
          </p>
        </section>
      ) : null}

      <section id="connections" className="rl-panel space-y-4 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Connections</h2>
        <p className="text-sm text-rl_muted">
          Google Account is authentication. Gmail and YouTube are separate authorizations.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rl_border px-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {operator?.avatarUrl ? (
                <img src={operator.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rl_surfaceActive text-xs font-semibold">
                  {(operator?.name || "G").slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-rl_text">Google Account</p>
                <p className="truncate text-xs text-rl_muted">
                  {operator ? `${operator.name || "Operator"} · ${operator.email}` : "Not signed in"}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-rl_ok">
              {connections?.googleAccount?.status === "CONNECTED" || operator ? "Connected" : "Not connected"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-rl_border px-3 py-3">
            <div>
              <p className="text-sm font-medium text-rl_text">Gmail</p>
              <p className="text-xs text-rl_muted">Mailbox access is not requested at sign-in.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-rl_warning">Not connected</span>
              <button
                type="button"
                className="rl-btn-ghost px-3 py-1.5 text-xs"
                onClick={async () => {
                  const result = await fetch("/api/connections/google", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "GMAIL" }),
                  }).then((response) => response.json()).catch(() => ({}));
                  setConnectionNote(result.message || "Gmail connection opens in the next phase.");
                }}
              >
                Connect
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-rl_border px-3 py-3">
            <div>
              <p className="text-sm font-medium text-rl_text">YouTube</p>
              <p className="text-xs text-rl_muted">Channel attach is separate from Google login.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-rl_warning">Not connected</span>
              <button
                type="button"
                className="rl-btn-ghost px-3 py-1.5 text-xs"
                onClick={async () => {
                  const result = await fetch("/api/connections/google", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "YOUTUBE" }),
                  }).then((response) => response.json()).catch(() => ({}));
                  setConnectionNote(result.message || "YouTube connection opens in the next phase.");
                }}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
        {connectionNote ? <p className="text-xs text-rl_muted">{connectionNote}</p> : null}
      </section>

      <section className="rl-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Theme</h2>
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

      <section className="rl-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rl_text">Data &amp; sync</h2>
        <p className="text-sm text-rl_muted">
          Schema version {SCHEMA_VERSION}. {campaigns.length} campaigns, {accounts.length} accounts.
          Local SQLite is the operational source of truth.
        </p>
        <ul className="space-y-2 text-sm text-rl_muted">
          <li>Operator · {operator ? "Signed in with Google" : "Not signed in"}</li>
          <li>Active profile · {activeProfile?.displayName || "—"}</li>
          <li>
            Local database ·{" "}
            {dbHealth?.ok === false || dbHealth?.local?.healthy === false
              ? `Error${dbHealth?.local?.error || dbHealth?.error ? ` — ${dbHealth.local?.error || dbHealth.error}` : ""}`
              : "Healthy"}
          </li>
          <li>
            Cloud database ·{" "}
            {(() => {
              const sync = dbHealth?.sync;
              if (!sync?.cloudConfigured) return "Offline (not configured)";
              if (sync.state === "ERROR") return "Error";
              if (!sync.localHealthy) return "Error";
              return "Connected";
            })()}
          </li>
          <li>
            Sync ·{" "}
            {(() => {
              const sync = dbHealth?.sync;
              if (!sync?.cloudConfigured) return "Local only";
              if (sync.state === "SYNCED") return "Synced";
              if (sync.state === "PENDING" || sync.pendingOutbox > 0) return "Pending";
              if (sync.state === "SYNCING") return "Syncing";
              if (sync.state === "ERROR" || sync.state === "CONFLICT") return sync.state === "CONFLICT" ? "Conflict" : "Error";
              return sync.state || "Offline";
            })()}
          </li>
          <li>
            Last sync ·{" "}
            {dbHealth?.sync?.lastSyncAt
              ? new Date(dbHealth.sync.lastSyncAt).toLocaleString()
              : "—"}
          </li>
          <li>
            Pending operations · {dbHealth?.sync?.pendingOutbox ?? 0}
          </li>
        </ul>
        <button
          type="button"
          className="rl-btn-ghost"
          onClick={async () => {
            await fetch("/api/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pull: true, push: true }),
            }).catch(() => {});
            setDbHealth(await fetchDbHealth());
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
