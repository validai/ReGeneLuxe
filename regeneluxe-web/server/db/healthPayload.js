/** Client-facing Data & Sync payload from getDbHealth() / getSyncStatus(). */

export function tursoConfiguredFromEnv(env = process.env) {
  return Boolean(env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN);
}

/**
 * @param {object | null | undefined} health
 * @param {{ fetchFailed?: boolean, error?: string | null }} [options]
 */
export function toClientDbHealth(health, { fetchFailed = false, error = null } = {}) {
  const sync = health?.sync && typeof health.sync === "object" ? health.sync : {};
  const local = health?.local && typeof health.local === "object" ? health.local : {};
  const configured = typeof sync.cloudConfigured === "boolean"
    ? sync.cloudConfigured
    : tursoConfiguredFromEnv();

  const message = error
    || (typeof sync.error === "string" ? sync.error : null)
    || (typeof local.error === "string" ? local.error : null)
    || (typeof health?.error === "string" ? health.error : null)
    || null;

  const localHealthy = !fetchFailed
    && health?.ok !== false
    && local.healthy !== false
    && sync.localHealthy !== false;

  let state = typeof sync.state === "string" && sync.state ? sync.state : null;
  if (!state) {
    if (!configured) state = "LOCAL_ONLY";
    else if (fetchFailed || sync.cloudReachable === false) state = "OFFLINE";
    else state = "UNKNOWN";
  }

  return {
    ok: localHealthy,
    fetchFailed: Boolean(fetchFailed),
    error: fetchFailed ? (message || "Database health unavailable") : message,
    local: {
      healthy: fetchFailed ? (typeof local.healthy === "boolean" ? local.healthy : null) : health?.ok !== false && local.healthy !== false,
      mode: health?.mode ?? local.mode ?? null,
      schemaVersion: health?.schemaVersion ?? local.schemaVersion ?? null,
      error: fetchFailed ? (message || "Database health unavailable") : (local.error || health?.error || null),
    },
    sync: {
      localHealthy: fetchFailed ? Boolean(sync.localHealthy) : sync.localHealthy !== false,
      cloudConfigured: configured,
      cloudReachable: configured && sync.cloudReachable === true,
      state,
      lastSyncAt: sync.lastSyncAt || null,
      pendingOutbox: Number.isFinite(Number(sync.pendingOutbox)) ? Number(sync.pendingOutbox) : (fetchFailed ? null : 0),
      pendingJobs: Number.isFinite(Number(sync.pendingJobs)) ? Number(sync.pendingJobs) : (fetchFailed ? null : 0),
      error: sync.error || (fetchFailed ? message : null),
    },
  };
}
