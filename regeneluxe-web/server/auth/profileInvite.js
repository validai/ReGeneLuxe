/**
 * One-time operator-authorized profile creation invite.
 * Private-pilot preserve: unsolicited signup still uses APP_ALLOWED_GOOGLE_EMAILS.
 * A URL flag alone is never authorization.
 */
import { createHash, randomBytes } from "node:crypto";
import { initDb, getMeta, setMeta } from "../db/index.js";
import { createId, nowIso } from "../../src/data/ids.js";

export const PROFILE_INVITE_META_KEY = "profile_create_invite";
export const PROFILE_INVITE_TTL_MS = 15 * 60 * 1000;
export const PILOT_ACCESS_ALLOWLIST = "ALLOWLIST";
export const PILOT_ACCESS_PROFILE_INVITE = "PROFILE_INVITE";

export function normalizeInviteEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidInviteEmailShape(email) {
  const normalized = normalizeInviteEmail(email);
  // Practical Google-account shape; not a full RFC parser.
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized);
}

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function maskEmail(email) {
  const normalized = normalizeInviteEmail(email);
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return "";
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

export async function readProfileInvite() {
  await initDb();
  const raw = await getMeta(PROFILE_INVITE_META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeProfileInvite(invite) {
  await initDb();
  await setMeta(PROFILE_INVITE_META_KEY, JSON.stringify(invite));
}

export function inviteIsActive(invite, now = Date.now()) {
  if (!invite || invite.status !== "PENDING") return false;
  const expires = Date.parse(invite.expiresAt || "");
  if (!Number.isFinite(expires) || expires <= now) return false;
  return true;
}

/**
 * Create or replace a pending invite. Operator-initiated only.
 * @param {{ createdByOperatorId: string, email: string, ttlMs?: number }} args
 */
export async function createProfileInvite({
  createdByOperatorId,
  email,
  ttlMs = PROFILE_INVITE_TTL_MS,
} = {}) {
  const normalized = normalizeInviteEmail(email);
  if (!createdByOperatorId) throw new Error("Operator required.");
  if (!isValidInviteEmailShape(normalized)) throw new Error("Enter a valid Google email for the new profile.");

  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  const invite = {
    id: createId("pinv"),
    email: normalized,
    emailMasked: maskEmail(normalized),
    createdByOperatorId: String(createdByOperatorId),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    status: "PENDING",
    tokenHash: hashToken(token),
    consumedAt: null,
    consumedByOperatorId: null,
    revokeReason: null,
  };
  await writeProfileInvite(invite);
  // Return plaintext token only to the creating session for optional cookie binding; not required for email match.
  return { invite: publicInvite(invite), token };
}

export function publicInvite(invite) {
  if (!invite) return null;
  return {
    id: invite.id,
    emailMasked: invite.emailMasked || maskEmail(invite.email),
    status: invite.status,
    createdAt: invite.createdAt || null,
    expiresAt: invite.expiresAt || null,
    active: inviteIsActive(invite),
  };
}

export async function getActiveProfileInvite() {
  const invite = await readProfileInvite();
  if (!inviteIsActive(invite)) {
    if (invite?.status === "PENDING") {
      await writeProfileInvite({
        ...invite,
        status: "EXPIRED",
        revokeReason: "expired",
      });
      return null;
    }
    return null;
  }
  return invite;
}

export async function findValidInviteForEmail(email) {
  const invite = await getActiveProfileInvite();
  if (!invite) return null;
  if (normalizeInviteEmail(email) !== normalizeInviteEmail(invite.email)) return null;
  return invite;
}

export async function revokeProfileInvite(reason = "revoked") {
  const invite = await readProfileInvite();
  if (!invite || invite.status !== "PENDING") return null;
  const next = {
    ...invite,
    status: "REVOKED",
    revokeReason: String(reason || "revoked"),
  };
  await writeProfileInvite(next);
  return publicInvite(next);
}

export async function consumeProfileInvite(inviteId, operatorId, reason = "profile_created") {
  const invite = await readProfileInvite();
  if (!invite || invite.id !== inviteId) return { ok: false, reason: "missing" };
  if (invite.status === "CONSUMED") return { ok: false, reason: "already_consumed" };
  if (invite.status !== "PENDING" && invite.status !== "EXPIRED") {
    return { ok: false, reason: "not_pending" };
  }
  const next = {
    ...invite,
    status: "CONSUMED",
    consumedAt: nowIso(),
    consumedByOperatorId: String(operatorId || ""),
    revokeReason: String(reason || "profile_created"),
  };
  await writeProfileInvite(next);
  return { ok: true, invite: publicInvite(next) };
}

/**
 * Evaluate Google email against pilot allowlist OR active one-time invite.
 * createProfile query flags are ignored here.
 */
export async function evaluatePilotEmailAccess(email, { allowlisted = null } = {}) {
  const normalized = normalizeInviteEmail(email);
  if (!normalized) {
    return { ok: false, reason: "missing_email", via: null, invite: null };
  }

  const { isEmailAllowed } = await import("./allowlist.js");
  if (allowlisted === true || (allowlisted == null && isEmailAllowed(normalized))) {
    return { ok: true, reason: null, via: PILOT_ACCESS_ALLOWLIST, invite: null };
  }

  const active = await getActiveProfileInvite();
  if (active) {
    if (normalizeInviteEmail(active.email) === normalized) {
      return { ok: true, reason: null, via: PILOT_ACCESS_PROFILE_INVITE, invite: active };
    }
    return { ok: false, reason: "invite_mismatch", via: null, invite: active };
  }

  return { ok: false, reason: "not_allowlisted", via: null, invite: null };
}

export async function operatorHasPilotAccess(operator) {
  if (!operator || operator.status === "INACTIVE") return false;
  const { isEmailAllowed } = await import("./allowlist.js");
  if (isEmailAllowed(operator.email)) return true;
  if (operator.pilotAccessGrant === PILOT_ACCESS_PROFILE_INVITE) return true;
  // Pending invite still covers first login before grant is persisted.
  const invite = await findValidInviteForEmail(operator.email);
  return Boolean(invite);
}
