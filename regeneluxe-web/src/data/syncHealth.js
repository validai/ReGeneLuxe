/** Display labels for Settings / Data & Sync. Input is getSyncStatus() / health.sync. */

export function displayCloudDatabaseStatus(sync = {}) {
  if (sync.cloudConfigured === false) return "Not configured";
  if (sync.cloudConfigured !== true) return "—";
  if (sync.cloudReachable === false || sync.state === "OFFLINE") return "Offline";
  if (sync.localHealthy === false) return "Error";
  if (sync.state === "ERROR") return "Error";
  return "Connected";
}

export function displayCloudSyncStatus(sync = {}) {
  if (sync.cloudConfigured === false) return "Local only";
  if (sync.cloudConfigured !== true) return "—";
  if (sync.cloudReachable === false || sync.state === "OFFLINE") return "Offline";
  if (sync.state === "SYNCED") return "Synced";
  if (sync.state === "PENDING" || Number(sync.pendingOutbox) > 0) return "Pending";
  if (sync.state === "SYNCING") return "Syncing";
  if (sync.state === "CONFLICT") return "Conflict";
  if (sync.state === "ERROR") return "Error";
  return sync.state || "—";
}

export function mergeHealthWithSyncStatus(health, status) {
  if (!status || typeof status !== "object") return health;
  return {
    ...(health && typeof health === "object" ? health : {}),
    ok: health?.ok !== false,
    fetchFailed: false,
    sync: {
      ...(health?.sync || {}),
      ...status,
    },
  };
}

export function formatSyncLine({ label, reason } = {}) {
  if (reason && (label == null || label === "—")) return `— (${reason})`;
  if (reason) return `${label} — ${reason}`;
  return label ?? "—";
}

function line(label, reason = null) {
  return { label, reason };
}

function unknown(reason) {
  return {
    local: line("—", reason),
    cloud: line("—", reason),
    sync: line("—", reason),
    lastSync: line("—", reason),
    pending: line("—", reason),
  };
}

/**
 * Maps /api/db/health (or a fetch failure) onto Data & Sync rows.
 * "—" is only used when the value is genuinely unknown, with a reason.
 */
export function formatDataSyncDisplay(dbHealth) {
  if (dbHealth == null) return unknown("Waiting for database health");

  const sync = dbHealth.sync && typeof dbHealth.sync === "object" ? dbHealth.sync : null;
  const reason = dbHealth.error || dbHealth.local?.error || sync?.error || "Health request failed";

  if (!sync) return unknown(reason || "Health response did not include sync status");

  const configuredKnown = sync.cloudConfigured === true || sync.cloudConfigured === false;
  if (dbHealth.fetchFailed && !configuredKnown) return unknown(reason);
  if (!configuredKnown) return unknown("Cloud configuration is unknown");

  const localHealthy = dbHealth.ok !== false && dbHealth.local?.healthy !== false;
  const localKnown = dbHealth.local?.healthy === true
    || dbHealth.local?.healthy === false
    || dbHealth.ok === true
    || dbHealth.ok === false;
  const local = !localKnown
    ? line("—", reason)
    : localHealthy
      ? line("Healthy")
      : line("Error", dbHealth.local?.error || dbHealth.error || null);

  const pendingKnown = sync.pendingOutbox != null && sync.pendingOutbox !== "";
  return {
    local,
    cloud: line(displayCloudDatabaseStatus(sync)),
    sync: line(displayCloudSyncStatus(sync)),
    lastSync: sync.lastSyncAt
      ? line(new Date(sync.lastSyncAt).toLocaleString())
      : line("—", "No completed sync recorded"),
    pending: pendingKnown ? line(String(sync.pendingOutbox)) : line("—", "Pending count is unknown"),
  };
}
