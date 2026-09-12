/**
 * Browser talks to local APIs on the same origin (`/api`).
 * Next Route Handlers serve these under canonical `npm run dev`.
 */
const DEFAULT_URL = "/api";

function friendlyNetworkError(error) {
  const message = String(error?.message || error || "");
  if (/ECONNREFUSED|Failed to fetch|NetworkError|abort/i.test(message)) {
    return {
      user: "ReGeneLuxe's local service is unavailable.",
      detail: message,
    };
  }
  return { user: message || "Request failed", detail: message };
}

export async function getRuntimeHealth() {
  try {
    const response = await fetch(`${DEFAULT_URL}/health`);
    if (!response.ok) {
      return { ok: false, state: "UNAVAILABLE", running: false, aiConfigured: false };
    }
    const body = await response.json();
    return {
      ok: true,
      state: body.state || (body.aiConfigured ? "RUNNING" : "AI_NOT_CONFIGURED"),
      running: true,
      aiConfigured: Boolean(body.aiConfigured),
      provider: body.provider || null,
      connectedProviders: body.connectedProviders || [],
      service: body.service || null,
    };
  } catch (error) {
    const friendly = friendlyNetworkError(error);
    return {
      ok: false,
      state: "UNAVAILABLE",
      running: false,
      aiConfigured: false,
      error: friendly.user,
      detail: friendly.detail,
    };
  }
}

export async function getRuntimeStatus() {
  try {
    const response = await fetch(`${DEFAULT_URL}/status`);
    if (!response.ok) {
      const health = await getRuntimeHealth();
      return { running: health.running, aiConfigured: false, state: health.state, error: health.error };
    }
    const body = await response.json();
    return {
      ...body,
      running: true,
      state: body.aiConfigured ? "RUNNING" : "AI_NOT_CONFIGURED",
    };
  } catch (error) {
    const friendly = friendlyNetworkError(error);
    return {
      running: false,
      aiConfigured: false,
      state: "UNAVAILABLE",
      error: friendly.user,
      detail: friendly.detail,
    };
  }
}

export async function completeAi(payload) {
  try {
    const response = await fetch(`${DEFAULT_URL}/ai/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        unavailable: response.status === 412 || response.status === 0,
        error: data.error || "AI request failed",
        userError: response.status === 412 ? "AI is not configured yet." : "AI request failed.",
      };
    }
    return { ok: true, ...data };
  } catch (error) {
    const friendly = friendlyNetworkError(error);
    return { ok: false, unavailable: true, error: friendly.user, detail: friendly.detail };
  }
}

export async function saveRuntimeSecret(kind, value, extra = {}) {
  try {
    const response = await fetch(`${DEFAULT_URL}/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, value, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, ...data };
  } catch (error) {
    const friendly = friendlyNetworkError(error);
    return { ok: false, error: friendly.user, detail: friendly.detail };
  }
}
