/** ReGeneLuxe account Google identity. Distinct from Google Cloud infrastructure ownership. */

export const GOOGLE_ACCOUNT_MISMATCH_MESSAGE =
  "This Google account does not match the ReGeneLuxe account currently signed in.";

export function normalizeGoogleEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function googleEmailsMatch(left, right) {
  const a = normalizeGoogleEmail(left);
  const b = normalizeGoogleEmail(right);
  return Boolean(a && b && a === b);
}

export function googleSubsMatch(left, right) {
  const a = String(left || "").trim();
  const b = String(right || "").trim();
  return Boolean(a && b && a === b);
}

export function displayAccountEmail(account) {
  return normalizeGoogleEmail(account?.email);
}

/** @deprecated use displayAccountEmail */
export function displayOperatorEmail(operator) {
  return displayAccountEmail(operator);
}

/**
 * Gmail/YouTube OAuth must return the same Google principal as the signed-in account.
 * @param {{ googleSub?: string, email?: string } | null} account
 * @param {{ googleSub?: string, sub?: string, email?: string } | null} incoming
 */
export function assertMatchesSignedInGoogleAccount(account, incoming = {}) {
  const expectedSub = String(account?.googleSub || "").trim();
  const incomingSub = String(incoming.googleSub || incoming.sub || "").trim();
  if (expectedSub && incomingSub && !googleSubsMatch(expectedSub, incomingSub)) {
    return { ok: false, error: GOOGLE_ACCOUNT_MISMATCH_MESSAGE };
  }
  const incomingEmail = incoming.email;
  if (account?.email && incomingEmail && !googleEmailsMatch(account.email, incomingEmail)) {
    return { ok: false, error: GOOGLE_ACCOUNT_MISMATCH_MESSAGE };
  }
  return { ok: true };
}
