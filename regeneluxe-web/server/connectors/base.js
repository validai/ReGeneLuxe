import { CAPABILITY, PROVIDER_READINESS, expandCapabilities } from "./capabilities.js";
import { getProviderAppCredentials, getAccountTokens, hasAccountTokens } from "../secrets/providers.js";

/**
 * @typedef {object} SocialConnector
 * @property {string} provider
 * @property {string[]} capabilities
 * @property {string} readiness
 * @property {string} setupInstructions
 * @property {() => Promise<object>} beginAuth
 * @property {(input: object) => Promise<object>} completeAuth
 * @property {(account: object) => Promise<object>} getProfile
 * @property {(account: object) => Promise<object>} getAccountMetrics
 * @property {(account: object) => Promise<object>} getContent
 * @property {(account: object, contentId: string) => Promise<object>} getContentMetrics
 * @property {(account: object, payload: object) => Promise<object>} [publishContent]
 * @property {(account: object, payload: object) => Promise<object>} [scheduleContent]
 * @property {(account: object) => Promise<object>} [getComments]
 * @property {(account: object) => Promise<object>} [getMentions]
 * @property {(account: object) => Promise<object>} [getMessages]
 * @property {(account: object) => Promise<object>} refreshAuth
 * @property {(account: object) => Promise<object>} disconnect
 */

export function unavailable(reason, extra = {}) {
  return { ok: false, unavailable: true, reason, ...extra };
}

export function setupRequired(provider, instructions) {
  return {
    ok: false,
    readiness: PROVIDER_READINESS.SETUP_REQUIRED,
    reason: "SETUP_REQUIRED",
    message: `${provider} app credentials are not configured.`,
    instructions,
  };
}

export function envCredentials(provider, envKeys) {
  const fromEnv = {};
  let complete = true;
  for (const [field, envName] of Object.entries(envKeys)) {
    const value = process.env[envName] || "";
    fromEnv[field] = value;
    if (!value) complete = false;
  }
  const stored = getProviderAppCredentials(provider);
  if (stored?.clientId) {
    return {
      complete: Boolean(stored.clientId && stored.clientSecret),
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
      redirectUri: stored.redirectUri || fromEnv.redirectUri || defaultRedirect(provider),
      source: "secrets",
    };
  }
  return {
    complete,
    clientId: fromEnv.clientId || "",
    clientSecret: fromEnv.clientSecret || "",
    redirectUri: fromEnv.redirectUri || defaultRedirect(provider),
    source: complete ? "env" : "missing",
  };
}

export function defaultRedirect(provider) {
  const base = process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174";
  return `${base}/api/oauth/${String(provider).toLowerCase()}/callback`;
}

export function baseConnector({
  provider,
  displayName,
  capabilities = [],
  readiness = PROVIDER_READINESS.SETUP_REQUIRED,
  setupInstructions = "",
  reviewNotes = "",
  envKeys = {},
  icon = null,
}) {
  const caps = expandCapabilities(capabilities);

  return {
    provider,
    displayName: displayName || provider,
    icon,
    capabilities: caps,
    readiness,
    setupInstructions,
    reviewNotes,
    CAPABILITY,

    resolveReadiness() {
      if (readiness === PROVIDER_READINESS.UNSUPPORTED) return PROVIDER_READINESS.UNSUPPORTED;
      if (readiness === PROVIDER_READINESS.PROVIDER_REVIEW_REQUIRED) {
        const creds = envCredentials(provider, envKeys);
        return creds.complete ? PROVIDER_READINESS.PROVIDER_REVIEW_REQUIRED : PROVIDER_READINESS.SETUP_REQUIRED;
      }
      const creds = envCredentials(provider, envKeys);
      return creds.complete ? PROVIDER_READINESS.IMPLEMENTED : PROVIDER_READINESS.SETUP_REQUIRED;
    },

    getAppCredentials() {
      return envCredentials(provider, envKeys);
    },

    async beginAuth({ accountId, returnTo } = {}) {
      const status = this.resolveReadiness();
      if (status === PROVIDER_READINESS.SETUP_REQUIRED) {
        return setupRequired(displayName || provider, setupInstructions);
      }
      if (status === PROVIDER_READINESS.PROVIDER_REVIEW_REQUIRED) {
        return {
          ok: false,
          readiness: status,
          reason: "PROVIDER_REVIEW_REQUIRED",
          message: reviewNotes || "Available after provider approval.",
        };
      }
      if (status === PROVIDER_READINESS.UNSUPPORTED) {
        return unavailable("This provider is not supported yet.");
      }
      return this._beginAuth({ accountId, returnTo });
    },

    async completeAuth(input) {
      return this._completeAuth(input);
    },

    async getProfile(account) {
      if (!hasAccountTokens(provider, account?.id)) {
        return unavailable("Account is not connected.");
      }
      return this._getProfile(account, getAccountTokens(provider, account.id));
    },

    async getAccountMetrics(account) {
      if (!hasAccountTokens(provider, account?.id)) {
        return unavailable("Account is not connected.");
      }
      return this._getAccountMetrics(account, getAccountTokens(provider, account.id));
    },

    async getContent(account) {
      if (!hasAccountTokens(provider, account?.id)) {
        return unavailable("Account is not connected.");
      }
      return this._getContent(account, getAccountTokens(provider, account.id));
    },

    async getContentMetrics(account, contentRef) {
      if (!hasAccountTokens(provider, account?.id)) {
        return unavailable("Account is not connected.");
      }
      return this._getContentMetrics(account, contentRef, getAccountTokens(provider, account.id));
    },

    async publishContent(account, payload) {
      if (!caps.includes(CAPABILITY.PUBLISH_TEXT)
        && !caps.includes(CAPABILITY.PUBLISH_IMAGE)
        && !caps.includes(CAPABILITY.PUBLISH_VIDEO)) {
        return unavailable("Publishing is not supported for this provider.");
      }
      if (!hasAccountTokens(provider, account?.id)) {
        return unavailable("Account is not connected.");
      }
      return this._publishContent(account, payload, getAccountTokens(provider, account.id));
    },

    async scheduleContent(account, payload) {
      if (!caps.includes(CAPABILITY.SCHEDULE)) {
        return unavailable("Scheduling is not supported for this provider.");
      }
      if (!hasAccountTokens(provider, account?.id)) {
        return unavailable("Account is not connected.");
      }
      return this._scheduleContent?.(account, payload, getAccountTokens(provider, account.id))
        || unavailable("Scheduling is not wired for this provider.");
    },

    async getComments(account) {
      if (!caps.includes(CAPABILITY.READ_COMMENTS)) return unavailable("Comments not supported.");
      if (!hasAccountTokens(provider, account?.id)) return unavailable("Account is not connected.");
      return this._getComments?.(account, getAccountTokens(provider, account.id))
        || unavailable("Comments not wired.");
    },

    async getMentions(account) {
      if (!caps.includes(CAPABILITY.READ_MENTIONS)) return unavailable("Mentions not supported.");
      if (!hasAccountTokens(provider, account?.id)) return unavailable("Account is not connected.");
      return this._getMentions?.(account, getAccountTokens(provider, account.id))
        || unavailable("Mentions not wired.");
    },

    async getMessages(account) {
      if (!caps.includes(CAPABILITY.READ_MESSAGES)) return unavailable("Messages not supported.");
      if (!hasAccountTokens(provider, account?.id)) return unavailable("Account is not connected.");
      return this._getMessages?.(account, getAccountTokens(provider, account.id))
        || unavailable("Messages not wired.");
    },

    async refreshAuth(account) {
      if (!hasAccountTokens(provider, account?.id)) return unavailable("Account is not connected.");
      return this._refreshAuth?.(account, getAccountTokens(provider, account.id))
        || unavailable("Token refresh not wired — reconnect the account.");
    },

    async disconnect(account) {
      return this._disconnect(account);
    },

    // Override points
    async _beginAuth() { return unavailable("Auth not implemented."); },
    async _completeAuth() { return unavailable("Auth callback not implemented."); },
    async _getProfile() { return unavailable("Profile not implemented."); },
    async _getAccountMetrics() { return unavailable("Account metrics not implemented."); },
    async _getContent() { return unavailable("Content list not implemented."); },
    async _getContentMetrics() { return unavailable("Content metrics not implemented."); },
    async _publishContent() { return unavailable("Publish not implemented."); },
    async _disconnect() { return { ok: true }; },
  };
}
