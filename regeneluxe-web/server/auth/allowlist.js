/**
 * Pilot allowlist. Email is an authorization attribute, not the durable identity key.
 * Fail closed when APP_ALLOWED_GOOGLE_EMAILS is missing/empty.
 */
export function parseAllowedEmails(raw = process.env.APP_ALLOWED_GOOGLE_EMAILS) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email, allowed = parseAllowedEmails()) {
  if (!email || typeof email !== "string") return false;
  if (!allowed.length) return false;
  return allowed.includes(email.trim().toLowerCase());
}
