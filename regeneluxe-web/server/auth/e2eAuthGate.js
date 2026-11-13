/**
 * E2E verified-auth backdoor gates.
 * All must pass. Canonical `npm run start:canonical` must never enable this.
 */

const INVALID_EMAIL_SUFFIX = "@example.invalid";

export function isE2eAuthEnabled(env = process.env) {
  if (String(env.REGENELUXE_E2E_AUTH || "") !== "1") return false;
  if (!String(env.REGENELUXE_E2E_SECRET || "").trim()) return false;
  // Managed canonical runtime never exposes E2E even if env leaked.
  if (String(env.RL_RUNTIME_MANAGED || "") === "1") return false;
  // Production builds require an explicit second flag.
  if (env.NODE_ENV === "production" && String(env.REGENELUXE_E2E_ALLOW_PRODUCTION || "") !== "1") {
    return false;
  }
  return true;
}

export function isE2eDisposableEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized.endsWith(INVALID_EMAIL_SUFFIX);
}

export function assertE2eSecret(provided, env = process.env) {
  const expected = String(env.REGENELUXE_E2E_SECRET || "");
  return Boolean(expected) && provided === expected;
}
