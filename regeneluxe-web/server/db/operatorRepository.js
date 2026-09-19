import { COLLECTIONS, initDb, list, get, upsert } from "./index.js";
import { emptyOperator, publicOperator } from "../../src/data/profileModels.js";
import { nowIso } from "../../src/data/ids.js";

export async function listOperators() {
  await initDb();
  return list(COLLECTIONS.operators);
}

export async function getOperator(id) {
  if (!id) return null;
  await initDb();
  return get(COLLECTIONS.operators, id);
}

export async function findOperatorByGoogleSub(googleSub) {
  const sub = String(googleSub || "").trim();
  if (!sub) return null;
  const operators = await listOperators();
  return operators.find((row) => row.googleSub === sub) || null;
}

export async function findOperatorByEmail(email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle) return null;
  const operators = await listOperators();
  return operators.find((row) => String(row.email || "").trim().toLowerCase() === needle) || null;
}

/**
 * Upsert by immutable Google `sub`. Email is an attribute.
 * Never stores OAuth tokens or client secrets.
 */
export async function upsertOperatorFromGoogle({
  googleSub,
  email,
  emailVerified,
  name,
  avatarUrl,
} = {}) {
  const sub = String(googleSub || "").trim();
  if (!sub) throw new Error("googleSub is required");

  const existing = await findOperatorByGoogleSub(sub);
  const now = nowIso();
  const record = emptyOperator({
    ...(existing || {}),
    id: existing?.id,
    googleSub: sub,
    email: email || existing?.email || "",
    emailVerified: emailVerified ?? existing?.emailVerified ?? false,
    name: name || existing?.name || "",
    avatarUrl: avatarUrl || existing?.avatarUrl || "",
    activeProfileId: existing?.activeProfileId || null,
    status: existing?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    createdAt: existing?.createdAt,
    lastLoginAt: now,
    updatedAt: now,
  });

  delete record.accessToken;
  delete record.refreshToken;
  delete record.idToken;
  delete record.token;

  return upsert(COLLECTIONS.operators, record);
}

export async function updateOperator(id, patch = {}) {
  const existing = await getOperator(id);
  if (!existing) return null;
  if (patch.activeProfileId && patch.activeProfileId === id) {
    throw new Error("activeProfileId must not equal operator ID");
  }
  const next = {
    ...existing,
    ...patch,
    id: existing.id,
    googleSub: existing.googleSub,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  delete next.accessToken;
  delete next.refreshToken;
  delete next.idToken;
  delete next.token;
  return upsert(COLLECTIONS.operators, next);
}

export function toPublicOperator(operator) {
  return publicOperator(operator);
}
