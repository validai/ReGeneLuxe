/**
 * Application-level access policy (NOT profile-to-profile authorization).
 *
 * Modes:
 * - local         — local owner runtime; any verified Google identity may onboard
 * - private_pilot — APP_ALLOWED_GOOGLE_EMAILS required
 * - public        — reserved; any verified identity (not enabled by default)
 *
 * Profile ownership is separate: one Google identity → one profile → one workspace.
 */

import { isEmailAllowed, parseAllowedEmails } from "./allowlist.js";

export const ACCESS_MODE_LOCAL = "local";
export const ACCESS_MODE_PRIVATE_PILOT = "private_pilot";
export const ACCESS_MODE_PUBLIC = "public";

export const APP_ACCESS_ALLOWLIST = "ALLOWLIST";
export const APP_ACCESS_LOCAL = "LOCAL";
export const APP_ACCESS_PUBLIC = "PUBLIC";

export function normalizeAccessEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Resolve access mode. Explicit REGENELUXE_ACCESS_MODE wins.
 * Otherwise localhost AUTH_URL ⇒ local (this product's default local runtime).
 */
export function getAccessMode({
  env = process.env,
} = {}) {
  const raw = String(env.REGENELUXE_ACCESS_MODE || "").trim().toLowerCase();
  if (raw === ACCESS_MODE_LOCAL || raw === ACCESS_MODE_PRIVATE_PILOT || raw === ACCESS_MODE_PUBLIC) {
    return raw;
  }
  const authUrl = String(env.AUTH_URL || "");
  if (/localhost|127\.0\.0\.1/i.test(authUrl)) return ACCESS_MODE_LOCAL;
  return ACCESS_MODE_PRIVATE_PILOT;
}

/**
 * Whether a verified Google email may enter the app (before/without a profile).
 * Does not create relationships between profiles.
 */
export function evaluateAppAccess(email, {
  env = process.env,
  allowedEmails = null,
} = {}) {
  const normalized = normalizeAccessEmail(email);
  if (!normalized) {
    return { ok: false, reason: "missing_email", mode: getAccessMode({ env }), via: null };
  }

  const mode = getAccessMode({ env });
  if (mode === ACCESS_MODE_LOCAL) {
    return { ok: true, reason: null, mode, via: APP_ACCESS_LOCAL };
  }
  if (mode === ACCESS_MODE_PUBLIC) {
    return { ok: true, reason: null, mode, via: APP_ACCESS_PUBLIC };
  }

  // private_pilot
  const allowed = allowedEmails || parseAllowedEmails(env.APP_ALLOWED_GOOGLE_EMAILS);
  if (isEmailAllowed(normalized, allowed)) {
    return { ok: true, reason: null, mode, via: APP_ACCESS_ALLOWLIST };
  }
  return { ok: false, reason: "not_authorized", mode, via: null };
}

/**
 * Ongoing session access for an existing operator row.
 * Local/public modes always allow active operators.
 * Private pilot: allowlist OR prior appAccessGrant from an earlier allowed entry.
 */
export function operatorHasAppAccess(operator, { env = process.env } = {}) {
  if (!operator || operator.status === "INACTIVE") return false;
  const mode = getAccessMode({ env });
  if (mode === ACCESS_MODE_LOCAL || mode === ACCESS_MODE_PUBLIC) return true;

  if (isEmailAllowed(operator.email, parseAllowedEmails(env.APP_ALLOWED_GOOGLE_EMAILS))) {
    return true;
  }
  const grant = String(operator.appAccessGrant || operator.pilotAccessGrant || "");
  // Historical PROFILE_INVITE grants are NOT honored — wrong model.
  return grant === APP_ACCESS_ALLOWLIST || grant === APP_ACCESS_LOCAL || grant === APP_ACCESS_PUBLIC;
}

export function accessDeniedMessage(reason) {
  if (reason === "missing_email") {
    return "Google did not return an email for this account.";
  }
  return "This Google account is not authorized for ReGeneLuxe access.";
}
