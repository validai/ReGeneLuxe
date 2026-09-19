/** Display labels for Settings / Data & Sync. Input is getSyncStatus() / health.sync. */

export function displayCloudDatabaseStatus(sync = {}) {
  if (!sync.cloudConfigured) return "Not configured";
  if (sync.cloudReachable === false || sync.state === "OFFLINE") return "Offline";
  if (sync.localHealthy === false) return "Error";
  if (sync.state === "ERROR") return "Error";
  return "Connected";
}

export function displayCloudSyncStatus(sync = {}) {
  if (!sync.cloudConfigured) return "Local only";
  if (sync.cloudReachable === false || sync.state === "OFFLINE") return "Offline";
  if (sync.state === "SYNCED") return "Synced";
  if (sync.state === "PENDING" || Number(sync.pendingOutbox) > 0) return "Pending";
  if (sync.state === "SYNCING") return "Syncing";
  if (sync.state === "CONFLICT") return "Conflict";
  if (sync.state === "ERROR") return "Error";
  return sync.state || "Offline";
}
