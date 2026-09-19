/** One Google principal per ManagedProfile. Email is the operator-visible identity. */

export const PILOT_GOOGLE_EMAIL = "djcoast239@gmail.com";
export const PILOT_PROFILE_SLUG = "dj-coast";

export function normalizeGoogleEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function googleEmailsMatch(left, right) {
  const a = normalizeGoogleEmail(left);
  const b = normalizeGoogleEmail(right);
  return Boolean(a && b && a === b);
}

export function googleIdentityMismatchMessage(boundEmail) {
  const email = normalizeGoogleEmail(boundEmail) || "the linked Google account";
  return `This profile is already linked to ${email}. Sign in with that Google account to continue.`;
}

export function boundGoogleEmail(profile, fallback = "") {
  return normalizeGoogleEmail(profile?.googleAccountEmail)
    || normalizeGoogleEmail(fallback);
}

export function displayGoogleIdentity(profile, operator) {
  return boundGoogleEmail(profile, operator?.email);
}

export function assertMatchesBoundGoogleIdentity(profile, { email = "", googleSub = "" } = {}) {
  const boundEmail = normalizeGoogleEmail(profile?.googleAccountEmail);
  const boundSub = String(profile?.googleAccountSub || "").trim();
  const incomingEmail = normalizeGoogleEmail(email);
  const incomingSub = String(googleSub || "").trim();

  if (boundSub && incomingSub && boundSub !== incomingSub) {
    return { ok: false, error: googleIdentityMismatchMessage(boundEmail || incomingEmail) };
  }
  if (boundEmail && incomingEmail && boundEmail !== incomingEmail) {
    return { ok: false, error: googleIdentityMismatchMessage(boundEmail) };
  }
  return { ok: true };
}
