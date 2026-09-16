import { createId, nowIso } from "./ids.js";
import { PLATFORMS } from "./models.js";
import { sanitizeAvatarUrl } from "./profileImage.js";

export const PROFILE_STATUSES = ["ACTIVE", "INACTIVE"];

export const PROFILE_CONNECTION_KINDS = {
  GOOGLE_ACCOUNT: "GOOGLE_ACCOUNT",
  GMAIL: "GMAIL",
  YOUTUBE: "YOUTUBE",
  SOCIAL: "SOCIAL",
};

export const PROFILE_CONNECTION_STATES = {
  CONNECTED: "CONNECTED",
  NOT_CONNECTED: "NOT_CONNECTED",
};

export function slugifyProfileName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeWebsite(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export function emptyOperator(partial = {}) {
  const timestamp = nowIso();
  return {
    id: partial.id || createId("opr"),
    googleSub: partial.googleSub || "",
    email: partial.email || "",
    emailVerified: Boolean(partial.emailVerified),
    name: partial.name || "",
    avatarUrl: partial.avatarUrl || "",
    activeProfileId: partial.activeProfileId || null,
    createdAt: partial.createdAt || timestamp,
    updatedAt: partial.updatedAt || timestamp,
    lastLoginAt: partial.lastLoginAt || timestamp,
  };
}

export function publicOperator(operator) {
  if (!operator) return null;
  return {
    id: operator.id,
    email: operator.email || "",
    emailVerified: Boolean(operator.emailVerified),
    name: operator.name || "",
    avatarUrl: operator.avatarUrl || "",
    activeProfileId: operator.activeProfileId || null,
    createdAt: operator.createdAt || null,
    updatedAt: operator.updatedAt || null,
    lastLoginAt: operator.lastLoginAt || null,
  };
}

export function emptyManagedProfile(partial = {}) {
  const timestamp = nowIso();
  const displayName = partial.displayName || "";
  const status = PROFILE_STATUSES.includes(partial.status) ? partial.status : "ACTIVE";
  return {
    id: partial.id || createId("prf"),
    ownerOperatorId: partial.ownerOperatorId || "",
    displayName,
    slug: partial.slug || slugifyProfileName(displayName) || createId("profile"),
    status,
    avatarUrl: sanitizeAvatarUrl(partial.avatarUrl || ""),
    avatarMediaId: partial.avatarMediaId || "",
    primaryEmail: partial.primaryEmail || "",
    website: normalizeWebsite(partial.website),
    primaryPublicUrl: partial.primaryPublicUrl || "",
    timezone: partial.timezone || "",
    shortDescription: partial.shortDescription || "",
    platforms: Array.isArray(partial.platforms)
      ? partial.platforms.filter((item) => PLATFORMS.includes(item) || typeof item === "string")
      : [],
    createdAt: partial.createdAt || timestamp,
    updatedAt: partial.updatedAt || timestamp,
  };
}

export function publicManagedProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    ownerOperatorId: profile.ownerOperatorId,
    displayName: profile.displayName || "",
    slug: profile.slug || "",
    status: profile.status || "ACTIVE",
    avatarUrl: sanitizeAvatarUrl(profile.avatarUrl || ""),
    avatarMediaId: profile.avatarMediaId || "",
    primaryEmail: profile.primaryEmail || "",
    website: profile.website ?? null,
    primaryPublicUrl: profile.primaryPublicUrl || "",
    timezone: profile.timezone || "",
    shortDescription: profile.shortDescription || "",
    platforms: Array.isArray(profile.platforms) ? profile.platforms : [],
    createdAt: profile.createdAt || null,
    updatedAt: profile.updatedAt || null,
    revision: profile.revision ?? null,
    syncStatus: profile.syncStatus || null,
  };
}

export function emptyProfileConnection(partial = {}) {
  const timestamp = nowIso();
  const kind = partial.kind || PROFILE_CONNECTION_KINDS.SOCIAL;
  return {
    id: partial.id || createId("pcn"),
    managedProfileId: partial.managedProfileId || "",
    ownerOperatorId: partial.ownerOperatorId || "",
    kind,
    provider: partial.provider || kind.toLowerCase(),
    status: partial.status || PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    displayLabel: partial.displayLabel || "",
    notes: partial.notes || "",
    createdAt: partial.createdAt || timestamp,
    updatedAt: partial.updatedAt || timestamp,
  };
}

export function resolveActiveProfile(operator, profiles = []) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const wanted = operator?.activeProfileId;
  if (wanted && wanted !== operator?.id) {
    const match = list.find((profile) => profile.id === wanted);
    if (match) return match;
  }
  return list[0];
}

export function isFixtureRecord(record) {
  if (!record || typeof record !== "object") return true;
  if (record.fixture === true) return true;
  if (record.provenance === "TEST" || record.provenance === "FIXTURE") return true;
  const id = String(record.id || "");
  return /^(test_|fixture_|vitest_|mock_)/i.test(id);
}
