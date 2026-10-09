import { randomBytes } from "node:crypto";
import { readSecrets, writeSecrets } from "../secrets.js";
import { CONNECTION_SESSION_PREFIX, isConnectionSessionId } from "../../src/data/connectionFlow.js";

const SESSION_TTL_MS = 15 * 60 * 1000;
const SECRET_KEYS = ["accessToken", "refreshToken", "token", "clientSecret", "pageAccessToken", "pages", "pagesCipher"];

function bucket() {
  const secrets = readSecrets();
  secrets.connectionSessions = secrets.connectionSessions || {};
  return secrets;
}

function assertPublic(record) {
  const serialized = JSON.stringify(record);
  for (const key of SECRET_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      throw new Error("Connection session cannot store provider credentials.");
    }
  }
  if (/access_token|refresh_token|client_secret/i.test(serialized)) {
    throw new Error("Connection session cannot store provider credentials.");
  }
  return record;
}

export function createConnectionSession({
  provider,
  operatorId,
  workspaceId,
  workspaceName = "",
} = {}) {
  const secrets = bucket();
  const now = Date.now();
  const id = `${CONNECTION_SESSION_PREFIX}${randomBytes(12).toString("hex")}`;
  const row = assertPublic({
    id,
    provider: String(provider || "").toLowerCase(),
    operatorId: operatorId || null,
    workspaceId: workspaceId || null,
    workspaceName: workspaceName || "",
    oauthStateRef: null,
    destinations: [],
    selectedIds: [],
    status: "started",
    failure: "",
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
  secrets.connectionSessions[id] = row;
  prune(secrets, now);
  writeSecrets(secrets);
  return row;
}

function prune(secrets, now = Date.now()) {
  for (const [key, value] of Object.entries(secrets.connectionSessions || {})) {
    const expires = Date.parse(value?.expiresAt || "");
    if (!expires || expires <= now) delete secrets.connectionSessions[key];
  }
}

export function getConnectionSession(id) {
  if (!isConnectionSessionId(id)) return null;
  const secrets = bucket();
  const row = secrets.connectionSessions?.[id];
  if (!row) return null;
  if (Date.parse(row.expiresAt) <= Date.now()) {
    delete secrets.connectionSessions[id];
    writeSecrets(secrets);
    return null;
  }
  return row;
}

export function updateConnectionSession(id, patch = {}) {
  const secrets = bucket();
  const current = secrets.connectionSessions?.[id];
  if (!current) return null;
  const next = assertPublic({
    ...current,
    ...patch,
    id: current.id,
    provider: current.provider,
    operatorId: current.operatorId,
    workspaceId: current.workspaceId,
  });
  delete next.accessToken;
  delete next.refreshToken;
  delete next.token;
  delete next.clientSecret;
  delete next.pages;
  secrets.connectionSessions[id] = next;
  writeSecrets(secrets);
  return next;
}

export function publicConnectionSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    provider: session.provider,
    workspaceId: session.workspaceId,
    workspaceName: session.workspaceName || "",
    destinations: Array.isArray(session.destinations) ? session.destinations : [],
    selectedIds: Array.isArray(session.selectedIds) ? session.selectedIds : [],
    status: session.status,
    failure: session.failure || "",
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
  };
}

export function clearConnectionSession(id) {
  if (!isConnectionSessionId(id)) return false;
  const secrets = bucket();
  delete secrets.connectionSessions[id];
  writeSecrets(secrets);
  return true;
}
