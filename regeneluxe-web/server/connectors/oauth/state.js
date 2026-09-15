import { createHash, randomBytes } from "node:crypto";
import { readSecrets, writeSecrets } from "../../secrets.js";

const STATE_TTL_MS = 15 * 60 * 1000;

function store() {
  const secrets = readSecrets();
  secrets.oauthStates = secrets.oauthStates || {};
  return secrets;
}

export function createOAuthState({ provider, accountId, returnTo = "/accounts" }) {
  const secrets = store();
  const state = randomBytes(24).toString("hex");
  secrets.oauthStates[state] = {
    provider: String(provider).toLowerCase(),
    accountId,
    returnTo,
    createdAt: Date.now(),
  };
  // prune expired
  const now = Date.now();
  for (const [key, value] of Object.entries(secrets.oauthStates)) {
    if (!value?.createdAt || now - value.createdAt > STATE_TTL_MS) {
      delete secrets.oauthStates[key];
    }
  }
  writeSecrets(secrets);
  return state;
}

export function consumeOAuthState(state) {
  if (!state) return { ok: false, error: "Missing OAuth state." };
  const secrets = store();
  const row = secrets.oauthStates?.[state];
  if (!row) return { ok: false, error: "OAuth session expired. Start connect again." };
  delete secrets.oauthStates[state];
  writeSecrets(secrets);
  if (Date.now() - row.createdAt > STATE_TTL_MS) {
    return { ok: false, error: "OAuth session expired. Start connect again." };
  }
  return { ok: true, ...row };
}

export function friendlyOAuthError(code, provider = "this account") {
  const label = String(provider);
  const map = {
    access_denied: `${label} authorization was denied.`,
    invalid_grant: `${label} needs to be reconnected.`,
    invalid_request: `${label} connection request was invalid. Try again.`,
    server_error: `${label} provider had a temporary error. Try again shortly.`,
    temporarily_unavailable: `${label} provider is temporarily unavailable.`,
    expired_state: `Connection session expired. Reconnect ${label}.`,
    missing_code: `Authorization incomplete for ${label}.`,
  };
  return map[code] || `${label} needs to be reconnected.`;
}

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
